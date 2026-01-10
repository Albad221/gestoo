/**
 * AI-Driven Conversation Handler
 *
 * Uses Gemini 3 Flash to handle all conversation flows naturally.
 * Supports French and Wolof languages.
 */

import type { WhatsAppMessage, ChatbotSession } from '@gestoo/types';
import { updateSession } from '../lib/session.js';
import { sendMessage, sendInteractiveButtons, sendInteractiveList, downloadMedia } from '../lib/wati.js';
import { supabase } from '../lib/supabase.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

## TES MISSIONS
1. **Inscription bailleurs**: Collecter nom + CNI, creer compte
2. **Check-in locataires**: Scanner passeport/CNI, enregistrer sejour, calculer TPT (1000 FCFA/nuit/personne)
3. **Paiement TPT**: Afficher solde, paiement Wave
4. **Support**: Repondre aux questions

## FORMAT DE REPONSE (JSON)
{
  "response": "Ton message naturel et chaleureux",
  "action": null | "create_landlord" | "create_guest" | "show_balance" | "generate_payment",
  "data": {},
  "language": "fr" | "wo"
}

## IMPORTANT
- Sois naturelle et conversationnelle, pas robotique
- En Wolof, parle comme on parle vraiment a Dakar
- Extrais les infos (nom, CNI) quand l'utilisateur les donne
- NE DIS JAMAIS que tu as cree un compte si tu n'as pas le nom ET le numero CNI
- Si tu recois une photo mais pas de numero CNI lisible, DEMANDE a l'utilisateur de taper son numero CNI
- Utilise "create_landlord" UNIQUEMENT quand tu as: full_name ET cni_number dans data

## REGLE ABSOLUE
Ne mens jamais. Si tu n'as pas reussi a extraire le CNI d'une photo, dis-le et demande a l'utilisateur de le taper.

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

  if (message.type === 'text' && message.text?.body) {
    userMessage = message.text.body;
  } else if (message.type === 'interactive') {
    // Handle button/list replies
    const buttonReply = message.interactive?.button_reply;
    const listReply = message.interactive?.list_reply;
    userMessage = buttonReply?.title || listReply?.title || 'Selection';
  } else if (message.type === 'image' && message.image?.id) {
    userMessage = '[Photo de document envoyée]';
    try {
      imageBuffer = await downloadMedia(message.image.id);
    } catch (e) {
      console.error('[AI] Failed to download image:', e);
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

  // Call Gemini
  const aiResponse = await callGemini(userMessage, userContext, history, imageBuffer);

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

  // Update session with new data
  await updateSession(phone, {
    state: session.state,
    landlord_id: actionResult.landlordId || session.landlord_id,
    data: {
      ...session.data,
      ...aiResponse.data,
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
  imageBuffer: Buffer | null
): Promise<AIResponse | null> {
  if (!genAI) {
    console.error('[AI] Gemini not configured');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // Build prompt
    const prompt = SYSTEM_PROMPT.replace('{{USER_CONTEXT}}', userContext);

    // Build conversation
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // System prompt
    parts.push({ text: prompt });

    // History
    for (const msg of history.slice(-10)) {
      parts.push({ text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}` });
    }

    // Current message
    parts.push({ text: `User: ${userMessage}` });

    // Image if present
    if (imageBuffer) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBuffer.toString('base64'),
        },
      });
      parts.push({ text: "Analyse cette photo de document d'identité et extrait les informations." });
    }

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
      const { full_name, cni_number } = aiResponse.data as { full_name?: string; cni_number?: string };

      if (!full_name || !cni_number) {
        console.error('[AI] Missing data for create_landlord');
        return {};
      }

      const { data: landlord, error } = await supabase
        .from('landlords')
        .insert({
          full_name,
          phone,
          cni_number,
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
      // TODO: Generate Wave payment link
      console.log('[AI] generate_payment not yet implemented');
      return {};
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
