/**
 * AI-Driven Conversation Handler
 *
 * Uses Gemini 3 Flash to handle all conversation flows naturally.
 * Supports French and Wolof languages.
 */

import type { WhatsAppMessage, ChatbotSession } from '@gestoo/types';
import { updateSession } from '../lib/session.js';
import { sendMessage, sendInteractiveButtons, sendInteractiveList, downloadMediaFromUrl } from '../lib/wati.js';
import { supabase } from '../lib/supabase.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { analyzeImage, formatExtractedInfo, type ExtractedDocument } from '../lib/ocr.js';
import { getWaveClient, formatWaveAmount, formatWavePhone, generateIdempotencyKey } from '../lib/wave.js';
import { extractTextFromPDF, isPDF, formatPDFForAnalysis } from '../lib/pdf-converter.js';
import { uploadDocument, mapCategoryToDocType, linkDocumentToProperty, getLandlordPendingDocuments } from '../lib/storage.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';
const genAI = GOOGLE_API_KEY ? new GoogleGenerativeAI(GOOGLE_API_KEY) : null;
// Gemini 3 Flash - meilleur Wolof et multimodal
const MODEL_NAME = 'gemini-3-flash-preview';

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const SYSTEM_PROMPT = `Tu es AWA, l'assistante WhatsApp intelligente de Gestoo - plateforme de gestion des hebergements touristiques au Senegal.

## PERSONNALITE
Tu es chaleureuse, professionnelle et naturelle. Tu parles comme une vraie Senegalaise.

## LANGUES
- **Francais**: Langue par defaut
- **Wolof**: Si l'utilisateur parle Wolof, reponds UNIQUEMENT en Wolof authentique et naturel
  - Utilise le vrai Wolof parlé au Senegal, pas du Wolof traduit mot-a-mot
  - Expressions: "Nanga def", "Mangi fi", "Jërëjëf", "Waaw", "Deedeet", "Ba beneen"

## CONTEXTE
{{USER_CONTEXT}}

## WORKFLOW COMPLET - ETAPE PAR ETAPE

### 1. INSCRIPTION BAILLEUR (etapes separees)
ETAPE 1a: Demande la CNI/passeport du bailleur UNIQUEMENT
ETAPE 1b: Une fois recu, extrais nom + NIN et confirme
- Action: "create_landlord" avec data: { full_name, nin }

### 2. HOMOLOGATION PROPRIETE (etapes separees, obligatoire avant de louer)
ETAPE 2a: Demande le titre de propriete ou bail UNIQUEMENT (pas les photos en meme temps!)
ETAPE 2b: Une fois recu, confirme et demande UNE photo du bien
ETAPE 2c: Une fois la photo recue, lance la demande d'homologation
- Action: "request_homologation" avec data: { full_name, location, property_type, address, city }
- Statut: en_attente -> approuve / rejete

### 3. CHECK-IN LOCATAIRES (seulement si propriete homologuee)
ETAPE 3a: Demande le passeport ou CNI du locataire UNIQUEMENT
ETAPE 3b: Une fois recu, demande les dates de sejour et nombre de personnes
- Calculer TPT: 1000 FCFA/nuit/personne
- Action: "create_guest" avec les infos du locataire

### 4. PAIEMENT TPT via Wave
- Afficher le solde TPT du
- Generer un lien de paiement Wave
- Action: "generate_payment" avec le montant

## FORMAT DE REPONSE (JSON)
{
  "response": "Ton message naturel et chaleureux",
  "action": null | "create_landlord" | "request_homologation" | "create_guest" | "show_balance" | "generate_payment",
  "data": {},
  "language": "fr" | "wo"
}

## REGLES CRITIQUES

### COLLECTE DE DOCUMENTS - UNE SEULE CHOSE A LA FOIS
- JAMAIS demander plusieurs documents en meme temps
- JAMAIS dire "envoyez votre CNI ET les photos" - c'est INTERDIT
- Toujours proceder etape par etape: un document, attendre, puis le suivant
- Apres chaque document recu, confirmer ce qui a ete extrait avant de demander le suivant

### AUTRES REGLES
- Sois naturelle et conversationnelle, pas robotique
- En Wolof, parle comme on parle vraiment a Dakar
- Extrais le NIN (pas le numero de carte) quand l'utilisateur envoie sa CNI
- NE DIS JAMAIS que tu as cree un compte si tu n'as pas le nom ET le NIN
- Si tu recois une photo mais pas de NIN lisible, DEMANDE a l'utilisateur de taper son NIN
- Un bailleur DOIT homologuer son bien avant de pouvoir enregistrer des locataires

## REGLE ABSOLUE
Ne mens jamais. Si tu n'as pas reussi a extraire le NIN d'une photo, dis-le et demande a l'utilisateur de le taper.

Reponds maintenant:`;

// =============================================================================
// TYPES
// =============================================================================

interface AIResponse {
  response: string;
  action: string | null;
  data: Record<string, unknown>;
  language: 'fr' | 'wo';
}

interface ConversationMessage {
  role: 'user' | 'model';
  content: string;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function handleWithAI(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  console.log(`[AI] Processing message for ${phone}`);

  // Extract message content
  let userMessage = '';
  let imageBuffer: Buffer | null = null;
  let extractedDoc: ExtractedDocument | null = null;

  if (message.type === 'text' && message.text?.body) {
    userMessage = message.text.body;

    // Handle reset command
    if (userMessage.toLowerCase().trim() === 'reset' || userMessage.toLowerCase().trim() === '/reset') {
      await updateSession(phone, { state: 'IDLE', landlord_id: undefined, data: {} });
      await sendMessage(phone, '🔄 Session réinitialisée. Envoyez un message pour recommencer.');
      return;
    }
  } else if (message.type === 'interactive') {
    // Handle button/list replies
    const buttonReply = message.interactive?.button_reply;
    const listReply = message.interactive?.list_reply;
    userMessage = buttonReply?.title || listReply?.title || 'Selection';
  } else if (message.type === 'image' && message.image?.id) {
    userMessage = '[Photo de document envoyée]';
    console.log('[AI] Image object received:', JSON.stringify(message.image, null, 2));
    try {
      // WATI adds a URL field to the image object (not in base types)
      const imageWithUrl = message.image as { id: string; url?: string; mimeType?: string };
      const imageUrl = imageWithUrl.url;
      console.log('[AI] Image URL:', imageUrl);
      console.log('[AI] Image ID:', imageWithUrl.id);
      if (imageUrl) {
        console.log('[AI] Downloading image from URL:', imageUrl);
        imageBuffer = await downloadMediaFromUrl(imageUrl);
      } else {
        console.log('[AI] No image URL available, skipping download');
      }
      // Use GPT-4 Vision for OCR if we have the image
      if (imageBuffer) {
        console.log('[AI] Image downloaded, running OCR with GPT-4 Vision...');
        extractedDoc = await analyzeImage(imageBuffer);
      }

      if (extractedDoc && extractedDoc.confidence > 50) {
        console.log('[AI] OCR successful:', extractedDoc);
        // Use the new formatExtractedInfo for all document types
        userMessage = `[Photo de document envoyée - OCR réussi]\n${formatExtractedInfo(extractedDoc)}`;

        // Upload document to storage
        if (imageBuffer) {
          const uploadResult = await uploadDocument({
            buffer: imageBuffer,
            mimeType: 'image/jpeg',
            documentType: mapCategoryToDocType(extractedDoc.category),
            landlordId: session.landlord_id,
            extractedData: extractedDoc,
          });
          if (uploadResult.success) {
            console.log('[AI] Document uploaded:', uploadResult.documentId);
            // Store document ID in session for later linking
            const pendingDocs = (session.data?.pending_document_ids as string[]) || [];
            pendingDocs.push(uploadResult.documentId!);
            session.data = { ...session.data, pending_document_ids: pendingDocs };
          }
        }
      } else {
        console.log('[AI] OCR failed or low confidence');
        userMessage = '[Photo de document envoyée - OCR échoué, impossible de lire le document]';
      }
    } catch (e) {
      console.error('[AI] Failed to download/process image:', e);
      userMessage = '[Photo envoyée mais erreur de téléchargement]';
    }
  } else if (message.type === 'document' && message.document) {
    // Handle PDF and other document types
    console.log('[AI] Document received:', JSON.stringify(message.document, null, 2));
    try {
      const doc = message.document as { id: string; url?: string; mimeType?: string; filename?: string };
      const docUrl = doc.url;
      const mimeType = doc.mimeType || '';
      const filename = doc.filename || 'document';

      console.log('[AI] Document URL:', docUrl);
      console.log('[AI] Document MIME type:', mimeType);

      if (docUrl) {
        console.log('[AI] Downloading document from URL:', docUrl);
        const docBuffer = await downloadMediaFromUrl(docUrl);

        // Check if it's a PDF
        if (mimeType.includes('pdf') || filename.endsWith('.pdf') || isPDF(docBuffer)) {
          console.log('[AI] Processing PDF document...');
          const pdfInfo = await extractTextFromPDF(docBuffer);

          if (pdfInfo && pdfInfo.text.length > 50) {
            console.log('[AI] PDF text extracted successfully');
            userMessage = formatPDFForAnalysis(pdfInfo);

            // Upload PDF to storage
            const uploadResult = await uploadDocument({
              buffer: docBuffer,
              mimeType: 'application/pdf',
              documentType: 'titre_propriete', // PDFs are typically property deeds
              landlordId: session.landlord_id,
              fileName: filename,
            });
            if (uploadResult.success) {
              console.log('[AI] PDF uploaded:', uploadResult.documentId);
              const pendingDocs = (session.data?.pending_document_ids as string[]) || [];
              pendingDocs.push(uploadResult.documentId!);
              session.data = { ...session.data, pending_document_ids: pendingDocs };
            }
          } else {
            // If text extraction fails, try as image (first page)
            console.log('[AI] PDF text extraction failed, trying as image...');
            // For now, just indicate we received a PDF
            userMessage = '[Document PDF reçu - Veuillez envoyer une photo ou capture d\'écran du document pour un meilleur traitement]';
          }
        } else if (mimeType.includes('image')) {
          // It's an image sent as document
          console.log('[AI] Image sent as document, processing...');
          imageBuffer = docBuffer;
          extractedDoc = await analyzeImage(imageBuffer);

          if (extractedDoc && extractedDoc.confidence > 50) {
            userMessage = `[Document image reçu - OCR réussi]\n${formatExtractedInfo(extractedDoc)}`;

            // Upload image document to storage
            const uploadResult = await uploadDocument({
              buffer: docBuffer,
              mimeType: mimeType || 'image/jpeg',
              documentType: mapCategoryToDocType(extractedDoc.category),
              landlordId: session.landlord_id,
              extractedData: extractedDoc,
              fileName: filename,
            });
            if (uploadResult.success) {
              console.log('[AI] Document image uploaded:', uploadResult.documentId);
              const pendingDocs = (session.data?.pending_document_ids as string[]) || [];
              pendingDocs.push(uploadResult.documentId!);
              session.data = { ...session.data, pending_document_ids: pendingDocs };
            }
          } else {
            userMessage = '[Document image reçu - OCR échoué]';
          }
        } else {
          userMessage = `[Document reçu: ${filename}] - Format non supporté. Veuillez envoyer une photo ou un PDF.`;
        }
      } else {
        userMessage = '[Document reçu mais URL non disponible]';
      }
    } catch (e) {
      console.error('[AI] Failed to process document:', e);
      userMessage = '[Document reçu mais erreur de traitement]';
    }
  }

  if (!userMessage && !imageBuffer) {
    await sendMessage(phone, "Je n'ai pas compris. Envoyez un message texte ou une photo.");
    return;
  }

  // Build user context
  const userContext = buildUserContext(phone, session);

  // Get conversation history
  const history: ConversationMessage[] = (session.data?.history as ConversationMessage[]) || [];

  // Call Gemini (pass extracted doc info for context)
  const aiResponse = await callGemini(userMessage, userContext, history, extractedDoc);

  if (!aiResponse) {
    await sendMessage(phone, "Désolé, une erreur s'est produite. Réessayez.");
    return;
  }

  // Update conversation history
  history.push({ role: 'user', content: userMessage });
  history.push({ role: 'model', content: aiResponse.response });

  // Keep only last 10 exchanges
  const trimmedHistory = history.slice(-20);

  // Execute action if needed
  const actionResult = await executeAction(phone, aiResponse, session);

  // Update session with new data (include extracted doc info if available)
  // Build extracted data based on document category
  const extractedData: Record<string, unknown> = {};
  if (extractedDoc && extractedDoc.confidence > 50) {
    extractedData.extracted_doc_category = extractedDoc.category;
    extractedData.extracted_doc_type = extractedDoc.documentType;

    switch (extractedDoc.category) {
      case 'identity':
        extractedData.extracted_full_name = extractedDoc.fullName;
        extractedData.extracted_nin = extractedDoc.nin;
        extractedData.extracted_dob = extractedDoc.dateOfBirth;
        extractedData.extracted_nationality = extractedDoc.nationality;
        break;
      case 'property_photo':
        extractedData.extracted_property_type = extractedDoc.propertyType;
        extractedData.extracted_property_description = extractedDoc.propertyDescription;
        extractedData.extracted_rooms = extractedDoc.estimatedRooms;
        extractedData.extracted_condition = extractedDoc.condition;
        break;
      case 'property_deed':
        extractedData.extracted_owner_name = extractedDoc.ownerName;
        extractedData.extracted_property_address = extractedDoc.propertyAddress;
        extractedData.extracted_property_area = extractedDoc.propertyArea;
        extractedData.extracted_registration_number = extractedDoc.registrationNumber;
        break;
    }
  }

  await updateSession(phone, {
    state: session.state,
    landlord_id: actionResult.landlordId || session.landlord_id,
    data: {
      ...session.data,
      ...aiResponse.data,
      ...extractedData,
      history: trimmedHistory,
      language: aiResponse.language,
    },
  });

  // Send response
  await sendMessage(phone, aiResponse.response);

  // Show menu for new landlords
  if (actionResult.showMenu) {
    await showMainMenu(phone, aiResponse.language === 'wo');
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildUserContext(phone: string, session: ChatbotSession): string {
  const parts: string[] = [];

  parts.push(`Telephone: ${phone}`);

  if (session.landlord_id) {
    parts.push(`Statut: Proprietaire inscrit (ID: ${session.landlord_id})`);
  } else {
    parts.push(`Statut: Non inscrit`);
  }

  if (session.data?.full_name) {
    parts.push(`Nom: ${session.data.full_name}`);
  }

  if (session.data?.language) {
    parts.push(`Langue preferee: ${session.data.language === 'wo' ? 'Wolof' : 'Francais'}`);
  }

  return parts.join('\n');
}

async function callGemini(
  userMessage: string,
  userContext: string,
  history: ConversationMessage[],
  extractedDoc: ExtractedDocument | null
): Promise<AIResponse | null> {
  if (!genAI) {
    console.error('[AI] Gemini not configured');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // Build prompt with extracted document info if available
    let contextWithDoc = userContext;
    if (extractedDoc && extractedDoc.confidence > 50) {
      contextWithDoc += `\n\nDOCUMENT EXTRAIT PAR OCR (confiance: ${extractedDoc.confidence}%):`;
      contextWithDoc += `\nCatégorie: ${extractedDoc.category}`;
      contextWithDoc += `\nType: ${extractedDoc.documentType}`;

      switch (extractedDoc.category) {
        case 'identity':
          contextWithDoc += `
- Nom complet: ${extractedDoc.fullName || 'Non extrait'}
- Prénom: ${extractedDoc.firstName || 'Non extrait'}
- Nom: ${extractedDoc.lastName || 'Non extrait'}
- NIN (Numéro d'Identification Nationale): ${extractedDoc.nin || 'Non extrait'}
- Date de naissance: ${extractedDoc.dateOfBirth || 'Non extrait'}
- Nationalité: ${extractedDoc.nationality || 'Non extrait'}
- Genre: ${extractedDoc.gender || 'Non extrait'}

IMPORTANT: Ces informations ont été extraites automatiquement. Utilise le NIN (pas le numéro de carte) pour créer le compte si l'utilisateur confirme.`;
          break;

        case 'property_photo':
          contextWithDoc += `
- Type de bien: ${extractedDoc.propertyType || 'Non déterminé'}
- Description: ${extractedDoc.propertyDescription || 'Non disponible'}
- Pièces estimées: ${extractedDoc.estimatedRooms || 'Non déterminé'}
- État: ${extractedDoc.condition || 'Non déterminé'}

IMPORTANT: Cette photo montre le bien du bailleur. Utilise ces informations pour la demande d'homologation.`;
          break;

        case 'property_deed':
          contextWithDoc += `
- Nom propriétaire: ${extractedDoc.ownerName || 'Non extrait'}
- Adresse du bien: ${extractedDoc.propertyAddress || 'Non extrait'}
- Surface: ${extractedDoc.propertyArea || 'Non extrait'}
- N° enregistrement: ${extractedDoc.registrationNumber || 'Non extrait'}
- Date enregistrement: ${extractedDoc.registrationDate || 'Non extrait'}

IMPORTANT: Ce document justifie la propriété ou le bail du bien. Utilise ces informations pour la demande d'homologation.`;
          break;

        default:
          if (extractedDoc.rawDescription) {
            contextWithDoc += `\nDescription: ${extractedDoc.rawDescription}`;
          }
      }
    }

    const prompt = SYSTEM_PROMPT.replace('{{USER_CONTEXT}}', contextWithDoc);

    // Build conversation
    const parts: Array<{ text: string }> = [];

    // System prompt
    parts.push({ text: prompt });

    // History
    for (const msg of history.slice(-10)) {
      parts.push({ text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}` });
    }

    // Current message
    parts.push({ text: `User: ${userMessage}` });

    parts.push({ text: 'Assistant (JSON):' });

    console.log('[AI] Calling Gemini...');
    const result = await model.generateContent(parts);
    const responseText = result.response.text();
    console.log('[AI] Gemini response:', responseText);

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as AIResponse;
      return parsed;
    }

    // Fallback if not JSON
    return {
      response: responseText,
      action: null,
      data: {},
      language: 'fr',
    };
  } catch (error) {
    console.error('[AI] Gemini error:', error);
    return null;
  }
}

async function executeAction(
  phone: string,
  aiResponse: AIResponse,
  session: ChatbotSession
): Promise<{ landlordId?: string; showMenu?: boolean }> {
  if (!aiResponse.action) {
    return {};
  }

  console.log(`[AI] Executing action: ${aiResponse.action}`);

  switch (aiResponse.action) {
    case 'create_landlord': {
      // Try to get data from AI response, fallback to session extracted data
      const aiData = aiResponse.data as {
        full_name?: string;
        first_name?: string;
        last_name?: string;
        nin?: string;
        cni_number?: string;
      };
      const sessionData = session.data as {
        extracted_full_name?: string;
        extracted_nin?: string;
        full_name?: string;
        nin?: string;
      };

      const full_name = aiData.full_name || sessionData.extracted_full_name || sessionData.full_name;
      const nin = aiData.nin || aiData.cni_number || sessionData.extracted_nin || sessionData.nin;

      if (!full_name || !nin) {
        console.error('[AI] Missing data for create_landlord:', { full_name, nin });
        return {};
      }

      // Split full name into first and last name
      const nameParts = full_name.trim().split(' ');
      const firstName = nameParts[0] || 'Prénom';
      const lastName = nameParts.slice(1).join(' ') || 'Nom';

      console.log('[AI] Creating landlord with:', { firstName, lastName, nin });

      const { data: landlord, error } = await supabase
        .from('landlords')
        .insert({
          first_name: firstName,
          last_name: lastName,
          phone,
          whatsapp_phone: phone,
          national_id: nin,
        })
        .select()
        .single();

      if (error) {
        console.error('[AI] Error creating landlord:', error);
        return {};
      }

      console.log(`[AI] Created landlord: ${landlord.id}`);
      return { landlordId: landlord.id, showMenu: true };
    }

    case 'request_homologation': {
      // Create a property with status='pending' for admin review
      let landlordId = session.landlord_id;

      // If no landlord exists, try to create one first
      if (!landlordId) {
        const sessionData = session.data as {
          extracted_full_name?: string;
          extracted_nin?: string;
          extracted_owner_name?: string;
        };
        const homologationData = aiResponse.data as { full_name?: string; nin?: string };

        const fullName = homologationData.full_name || sessionData.extracted_full_name || sessionData.extracted_owner_name;

        if (fullName) {
          console.log('[AI] Auto-creating landlord for homologation:', fullName);

          // Split full name
          const nameParts = fullName.trim().split(' ');
          const firstName = nameParts[0] || 'Prénom';
          const lastName = nameParts.slice(1).join(' ') || 'Nom';

          const { data: landlord, error: landlordError } = await supabase
            .from('landlords')
            .insert({
              first_name: firstName,
              last_name: lastName,
              phone,
              whatsapp_phone: phone,
              national_id: homologationData.nin || sessionData.extracted_nin || null,
            })
            .select()
            .single();

          if (landlordError) {
            console.error('[AI] Error auto-creating landlord:', landlordError);
            return {};
          }

          landlordId = landlord.id;
          console.log('[AI] Auto-created landlord:', landlordId);

          // Update session with landlord_id
          await updateSession(phone, { landlord_id: landlordId });
        } else {
          console.error('[AI] No landlord_id and no name to create one');
          return {};
        }
      }

      const aiData = aiResponse.data as {
        property_name?: string;
        property_type?: string;
        address?: string;
        city?: string;
        location?: string;
        num_rooms?: number;
        full_name?: string;
        surface?: string;
        registration_number?: string;
      };
      const sessionData = session.data as {
        extracted_property_type?: string;
        extracted_property_description?: string;
        extracted_rooms?: number;
        extracted_owner_name?: string;
        extracted_property_address?: string;
      };

      // Parse location if provided (e.g., "Fandène, Thiès")
      let parsedAddress = aiData.address || sessionData.extracted_property_address;
      let parsedCity = aiData.city;
      if (aiData.location && !parsedCity) {
        const locationParts = aiData.location.split(',').map(s => s.trim());
        if (locationParts.length >= 2) {
          parsedAddress = parsedAddress || locationParts[0];
          parsedCity = locationParts[locationParts.length - 1];
        } else {
          parsedCity = locationParts[0];
        }
      }

      // Get property info from AI response or extracted OCR data
      const ownerName = aiData.full_name || sessionData.extracted_owner_name || 'Bailleur';
      const propertyName = aiData.property_name || `Propriété de ${ownerName}`;
      const propertyType = aiData.property_type || sessionData.extracted_property_type || 'apartment';
      const address = parsedAddress || 'Adresse à confirmer';
      const city = parsedCity || 'Dakar';
      const numRooms = aiData.num_rooms || sessionData.extracted_rooms || 1;
      const description = [
        sessionData.extracted_property_description,
        aiData.surface ? `Surface: ${aiData.surface}` : null,
        aiData.registration_number ? `N° enregistrement: ${aiData.registration_number}` : null,
      ].filter(Boolean).join('\n') || null;

      // Map property type to valid enum
      const typeMapping: Record<string, string> = {
        'appartement': 'apartment',
        'maison': 'villa',
        'villa': 'villa',
        'chambre': 'apartment',
        'studio': 'apartment',
        'hotel': 'hotel',
        'guesthouse': 'guesthouse',
      };
      const mappedType = typeMapping[propertyType.toLowerCase()] || 'apartment';

      console.log('[AI] Creating homologation request:', {
        landlord_id: session.landlord_id,
        propertyName,
        propertyType: mappedType,
        address,
        city,
      });

      const { data: property, error } = await supabase
        .from('properties')
        .insert({
          landlord_id: landlordId,
          name: propertyName,
          type: mappedType,
          status: 'pending',
          address,
          city,
          num_rooms: numRooms,
          description,
        })
        .select()
        .single();

      if (error) {
        console.error('[AI] Error creating homologation request:', error);
        return {};
      }

      console.log(`[AI] Created homologation request: ${property.id}`);

      // Link pending documents to the property
      const pendingDocIds = (session.data?.pending_document_ids as string[]) || [];
      if (pendingDocIds.length > 0) {
        console.log(`[AI] Linking ${pendingDocIds.length} documents to property ${property.id}`);
        for (const docId of pendingDocIds) {
          await linkDocumentToProperty(docId, property.id);
        }
        // Clear pending document IDs from session
        delete session.data?.pending_document_ids;
      }

      // Also link any documents uploaded for this landlord that don't have a property yet
      if (landlordId) {
        const unlinkedDocs = await getLandlordPendingDocuments(landlordId);
        if (unlinkedDocs.length > 0) {
          console.log(`[AI] Linking ${unlinkedDocs.length} unlinked landlord documents to property`);
          for (const doc of unlinkedDocs) {
            await linkDocumentToProperty(doc.id, property.id);
          }
        }
      }

      console.log(`[AI] Homologation request created for property: ${propertyName} at ${address}, ${city}`);

      return {};
    }

    case 'create_guest': {
      // TODO: Implement guest creation
      console.log('[AI] create_guest not yet implemented');
      return {};
    }

    case 'show_balance': {
      // TODO: Fetch and show balance
      console.log('[AI] show_balance not yet implemented');
      return {};
    }

    case 'generate_payment': {
      const { amount } = aiResponse.data as { amount?: number };

      if (!amount || amount <= 0) {
        console.error('[AI] Invalid amount for payment:', amount);
        return {};
      }

      if (!session.landlord_id) {
        console.error('[AI] No landlord_id for payment');
        return {};
      }

      console.log(`[AI] Generating Wave payment for ${amount} XOF`);

      try {
        const waveClient = getWaveClient();
        const baseUrl = process.env.APP_BASE_URL || 'https://gestoo.sn';

        const checkoutSession = await waveClient.createCheckoutSession(
          {
            amount: formatWaveAmount(amount, 'XOF'),
            currency: 'XOF',
            success_url: `${baseUrl}/payment/success`,
            error_url: `${baseUrl}/payment/error`,
            client_reference: `tpt-${session.landlord_id}-${Date.now()}`,
            restrict_payer_mobile: formatWavePhone(phone),
          },
          generateIdempotencyKey('tpt')
        );

        // Format amount for display
        const formattedAmount = new Intl.NumberFormat('fr-SN').format(amount) + ' FCFA';

        // Send payment link to user
        await sendMessage(
          phone,
          `💰 Paiement TPT: ${formattedAmount}\n\n` +
          `Cliquez sur ce lien pour payer via Wave:\n${checkoutSession.wave_launch_url}\n\n` +
          `⏱️ Ce lien expire dans 30 minutes.`
        );

        return {};
      } catch (error) {
        console.error('[AI] Failed to create Wave checkout:', error);
        return {};
      }
    }

    default:
      console.log(`[AI] Unknown action: ${aiResponse.action}`);
      return {};
  }
}

async function showMainMenu(phone: string, isWolof: boolean): Promise<void> {
  await sendInteractiveList(
    phone,
    isWolof ? 'Menu' : 'Menu Principal',
    isWolof ? 'Lan la bëgg def?' : 'Que souhaitez-vous faire ?',
    isWolof ? 'Gis tanneef yi' : 'Voir les options',
    [
      {
        title: isWolof ? 'Yorkat' : 'Gestion',
        rows: [
          {
            id: 'add_property',
            title: isWolof ? '🏠 Yokk kër' : '🏠 Ajouter propriété',
            description: isWolof ? 'Bindu kër bu bees' : 'Enregistrer un nouveau bien',
          },
          {
            id: 'guest_checkin',
            title: isWolof ? '👤 Locataire' : '👤 Nouveau locataire',
            description: isWolof ? 'Yégle ñëw' : 'Déclarer une arrivée',
          },
        ],
      },
      {
        title: isWolof ? 'Fey' : 'Paiements',
        rows: [
          {
            id: 'pay_tpt',
            title: isWolof ? '💰 Fey TPT' : '💰 Payer TPT',
            description: isWolof ? 'Fey cëru tubaab' : 'Régler la taxe',
          },
        ],
      },
    ]
  );
}
