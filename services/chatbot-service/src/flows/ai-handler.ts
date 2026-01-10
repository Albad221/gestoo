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
import { extractDocumentInfo, type ExtractedDocument } from '../lib/ocr.js';
import { getWaveClient, formatWaveAmount, formatWavePhone, generateIdempotencyKey } from '../lib/wave.js';

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

## WORKFLOW COMPLET

### 1. INSCRIPTION BAILLEUR
- Collecter: nom complet + NIN (Numero d'Identification Nationale)
- Le NIN est sur la carte CEDEAO biometrique (different du numero de carte)
- Action: "create_landlord" avec data: { full_name, nin }

### 2. HOMOLOGATION PROPRIETE (obligatoire avant de louer)
- Le bailleur doit faire homologuer son bien AVANT de pouvoir enregistrer des locataires
- Documents requis: titre de propriete ou bail, photos du bien
- Action: "request_homologation" - la demande sera examinee par l'administration
- Statut: en_attente -> approuve / rejete

### 3. CHECK-IN LOCATAIRES (seulement si propriete homologuee)
- Scanner passeport ou CNI du locataire
- Enregistrer: nom, nationalite, dates sejour, nombre de personnes
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

## IMPORTANT
- Sois naturelle et conversationnelle, pas robotique
- En Wolof, parle comme on parle vraiment a Dakar
- Extrais le NIN (pas le numero de carte) quand l'utilisateur envoie sa CNI
- NE DIS JAMAIS que tu as cree un compte si tu n'as pas le nom ET le NIN
- Si tu recois une photo mais pas de NIN lisible, DEMANDE a l'utilisateur de taper son NIN
- Utilise "create_landlord" UNIQUEMENT quand tu as: full_name ET nin dans data
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
      await updateSession(phone, { state: 'IDLE', landlord_id: null, data: {} });
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
        extractedDoc = await extractDocumentInfo(imageBuffer);
      }

      if (extractedDoc && extractedDoc.confidence > 50) {
        console.log('[AI] OCR successful:', extractedDoc);
        userMessage = `[Photo de document envoyée - OCR réussi]
Informations extraites:
- Type: ${extractedDoc.documentType}
- Nom: ${extractedDoc.lastName}
- Prénom: ${extractedDoc.firstName}
- NIN: ${extractedDoc.nin}
- Date de naissance: ${extractedDoc.dateOfBirth}
- Nationalité: ${extractedDoc.nationality}`;
      } else {
        console.log('[AI] OCR failed or low confidence');
        userMessage = '[Photo de document envoyée - OCR échoué, impossible de lire le document]';
      }
    } catch (e) {
      console.error('[AI] Failed to download/process image:', e);
      userMessage = '[Photo envoyée mais erreur de téléchargement]';
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
  await updateSession(phone, {
    state: session.state,
    landlord_id: actionResult.landlordId || session.landlord_id,
    data: {
      ...session.data,
      ...aiResponse.data,
      // Store extracted doc info for later use
      ...(extractedDoc && extractedDoc.confidence > 50 ? {
        extracted_full_name: extractedDoc.fullName,
        extracted_nin: extractedDoc.nin,
        extracted_doc_type: extractedDoc.documentType,
      } : {}),
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
      contextWithDoc += `\n\nDOCUMENT EXTRAIT PAR OCR (confiance: ${extractedDoc.confidence}%):
- Type: ${extractedDoc.documentType}
- Nom complet: ${extractedDoc.fullName}
- Prénom: ${extractedDoc.firstName}
- Nom: ${extractedDoc.lastName}
- NIN (Numéro d'Identification Nationale): ${extractedDoc.nin}
- Date de naissance: ${extractedDoc.dateOfBirth}
- Nationalité: ${extractedDoc.nationality}
- Genre: ${extractedDoc.gender}

IMPORTANT: Ces informations ont été extraites automatiquement. Utilise le NIN (pas le numéro de carte) pour créer le compte si l'utilisateur confirme.`;
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
      const aiData = aiResponse.data as { full_name?: string; nin?: string; cni_number?: string };
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

      console.log('[AI] Creating landlord with:', { full_name, nin });

      const { data: landlord, error } = await supabase
        .from('landlords')
        .insert({
          full_name,
          phone,
          cni_number: nin, // Store NIN in cni_number field
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
