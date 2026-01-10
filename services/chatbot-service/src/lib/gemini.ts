/**
 * Gemini AI Integration Module
 *
 * Provides multimodal AI capabilities for the chatbot:
 * - Natural language understanding (French + Wolof)
 * - Document/ID analysis from images
 * - Intelligent conversation handling
 * - Context-aware responses
 */

import { GoogleGenerativeAI, Part } from '@google/generative-ai';

// =============================================================================
// CONFIGURATION
// =============================================================================

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';

if (!GOOGLE_API_KEY) {
  console.warn('[Gemini] No Google API key found. AI features will be disabled.');
}

const genAI = GOOGLE_API_KEY ? new GoogleGenerativeAI(GOOGLE_API_KEY) : null;

// Use Gemini 2.0 Flash for fast, multimodal responses
const MODEL_NAME = 'gemini-2.0-flash-exp';

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

const SYSTEM_PROMPT_FR_WO = `Tu es l'assistant virtuel de Gestoo, une plateforme de gestion des hebergements touristiques au Senegal.

LANGUES SUPPORTEES:
- Francais (langue principale)
- Wolof (langue locale senegalaise)

Quand l'utilisateur parle en Wolof, reponds en Wolof. Sinon, reponds en Francais.

Exemples Wolof:
- "Nanga def" = "Comment vas-tu" -> Repondre en Wolof
- "Mangi fi" = "Je suis la/Ca va" -> Repondre en Wolof
- "Jërëjëf" = "Merci" -> Repondre en Wolof
- "Ndax" = "Est-ce que" -> Repondre en Wolof

TON ROLE:
1. Aider les proprietaires (bailleurs) a s'inscrire sur la plateforme
2. Guider l'enregistrement des locataires (check-in KYC)
3. Faciliter le paiement de la Taxe de Promotion Touristique (TPT) via Wave
4. Repondre aux questions sur les reglementations

CONTEXTE LEGAL SENEGAL:
- TPT: 1000 FCFA par nuit par personne
- Declaration obligatoire de tous les touristes
- Documents acceptes: Passeport, CNI, Titre de sejour
- Les mineurs doivent avoir un accompagnateur declare

STYLE:
- Sois professionnel mais chaleureux
- Utilise des emojis avec parcimonie
- Sois concis et clair
- Guide l'utilisateur etape par etape`;

const DOCUMENT_ANALYSIS_PROMPT = `Analyse cette image de document d'identite et extrait les informations suivantes en JSON:

{
  "documentType": "passport" | "national_id" | "residence_permit" | "other",
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "extractedData": {
    "firstName": "...",
    "lastName": "...",
    "fullName": "...",
    "documentNumber": "...",
    "nationality": "...",
    "dateOfBirth": "YYYY-MM-DD",
    "expiryDate": "YYYY-MM-DD",
    "gender": "M" | "F",
    "issuingCountry": "..."
  },
  "warnings": ["liste des problemes detectes"]
}

Si l'image n'est pas un document d'identite valide, retourne isValid: false avec une explication dans warnings.
Retourne UNIQUEMENT le JSON, sans texte supplementaire.`;

// =============================================================================
// TYPES
// =============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageData?: {
    mimeType: string;
    data: string; // base64
  };
}

export interface DocumentAnalysisResult {
  documentType: 'passport' | 'national_id' | 'residence_permit' | 'other';
  isValid: boolean;
  confidence: number;
  extractedData: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    documentNumber?: string;
    nationality?: string;
    dateOfBirth?: string;
    expiryDate?: string;
    gender?: string;
    issuingCountry?: string;
  };
  warnings: string[];
}

export interface ConversationContext {
  landlordId?: string;
  landlordName?: string;
  propertyId?: string;
  propertyName?: string;
  currentFlow?: string;
  guestData?: Record<string, unknown>;
}

// =============================================================================
// AI FUNCTIONS
// =============================================================================

/**
 * Send a message to Gemini and get a response
 * Supports both text and multimodal (text + image) inputs
 */
export async function chat(
  messages: ChatMessage[],
  context?: ConversationContext
): Promise<string> {
  if (!genAI) {
    return "Je suis desole, le service IA n'est pas disponible pour le moment. Veuillez reessayer plus tard.";
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // Build context-aware system prompt
    let systemPrompt = SYSTEM_PROMPT_FR_WO;
    if (context) {
      systemPrompt += '\n\nCONTEXTE ACTUEL:\n';
      if (context.landlordName) systemPrompt += `- Proprietaire: ${context.landlordName}\n`;
      if (context.propertyName) systemPrompt += `- Propriete: ${context.propertyName}\n`;
      if (context.currentFlow) systemPrompt += `- Etape: ${context.currentFlow}\n`;
    }

    // Convert messages to Gemini format
    const parts: Part[] = [];

    // Add system prompt as first part
    parts.push({ text: systemPrompt });

    // Add conversation history
    for (const msg of messages) {
      if (msg.imageData) {
        parts.push({
          inlineData: {
            mimeType: msg.imageData.mimeType,
            data: msg.imageData.data,
          },
        });
      }
      parts.push({ text: `${msg.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${msg.content}` });
    }

    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    return text || "Je n'ai pas pu generer une reponse. Veuillez reformuler.";
  } catch (error) {
    console.error('[Gemini] Chat error:', error);
    return "Une erreur s'est produite. Veuillez reessayer.";
  }
}

/**
 * Analyze a document image and extract information
 */
export async function analyzeDocument(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<DocumentAnalysisResult> {
  if (!genAI) {
    return {
      documentType: 'other',
      isValid: false,
      confidence: 0,
      extractedData: {},
      warnings: ['Service IA non disponible'],
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const imagePart: Part = {
      inlineData: {
        mimeType,
        data: imageBuffer.toString('base64'),
      },
    };

    const result = await model.generateContent([
      { text: DOCUMENT_ANALYSIS_PROMPT },
      imagePart,
    ]);

    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as DocumentAnalysisResult;
      console.log('[Gemini] Document analysis result:', parsed);
      return parsed;
    }

    return {
      documentType: 'other',
      isValid: false,
      confidence: 0,
      extractedData: {},
      warnings: ['Impossible de parser la reponse'],
    };
  } catch (error) {
    console.error('[Gemini] Document analysis error:', error);
    return {
      documentType: 'other',
      isValid: false,
      confidence: 0,
      extractedData: {},
      warnings: [`Erreur d'analyse: ${error instanceof Error ? error.message : 'Inconnue'}`],
    };
  }
}

/**
 * Detect the language of a message
 */
export async function detectLanguage(text: string): Promise<'fr' | 'wo' | 'en' | 'unknown'> {
  if (!genAI) return 'fr';

  // Quick heuristics for common Wolof words
  const wolofIndicators = [
    'nanga def', 'mangi fi', 'jërëjëf', 'waaw', 'deedeet', 'ndax',
    'baal ma', 'ana', 'naka', 'yow', 'man', 'moom', 'ñu', 'rekk',
    'degg', 'xam', 'bëgg', 'jox', 'jël', 'dem', 'ñëw', 'lekk',
  ];

  const lowerText = text.toLowerCase();
  for (const indicator of wolofIndicators) {
    if (lowerText.includes(indicator)) {
      return 'wo';
    }
  }

  // Check for French indicators
  const frenchIndicators = ['bonjour', 'merci', 'je', 'vous', 'nous', 'est-ce', 'comment'];
  for (const indicator of frenchIndicators) {
    if (lowerText.includes(indicator)) {
      return 'fr';
    }
  }

  return 'fr'; // Default to French
}

/**
 * Generate a contextual response based on the current flow state
 */
export async function generateFlowResponse(
  userMessage: string,
  flowState: string,
  context: ConversationContext,
  imageBuffer?: Buffer
): Promise<{ response: string; suggestedAction?: string; extractedData?: Record<string, unknown> }> {
  if (!genAI) {
    return { response: "Service temporairement indisponible." };
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const flowPrompt = `${SYSTEM_PROMPT_FR_WO}

ETAT ACTUEL DU FLUX: ${flowState}
CONTEXTE: ${JSON.stringify(context)}

MESSAGE DE L'UTILISATEUR: ${userMessage}

Reponds de maniere appropriee pour cette etape du flux.
Si l'utilisateur semble confus ou hors-sujet, guide-le gentiment vers l'etape actuelle.

Format de reponse JSON:
{
  "response": "Ta reponse a l'utilisateur",
  "suggestedAction": "next_step" | "retry" | "cancel" | "help" | null,
  "extractedData": { ... donnees extraites du message si pertinent ... }
}`;

    const parts: Part[] = [{ text: flowPrompt }];

    if (imageBuffer) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBuffer.toString('base64'),
        },
      });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { response: text };
  } catch (error) {
    console.error('[Gemini] Flow response error:', error);
    return { response: "Une erreur s'est produite. Tapez 'menu' pour recommencer." };
  }
}

/**
 * Quick intent detection for routing
 */
export async function detectIntent(
  message: string
): Promise<{
  intent: 'greeting' | 'register_landlord' | 'checkin_guest' | 'payment' | 'help' | 'unknown';
  confidence: number;
  language: 'fr' | 'wo';
}> {
  const lowerMessage = message.toLowerCase().trim();
  const detectedLang = await detectLanguage(message);
  // Map to supported languages (fr or wo only)
  const language: 'fr' | 'wo' = detectedLang === 'wo' ? 'wo' : 'fr';

  // Greetings
  const greetings = ['bonjour', 'salut', 'hello', 'hi', 'bonsoir', 'nanga def', 'salam'];
  if (greetings.some(g => lowerMessage.includes(g))) {
    return { intent: 'greeting', confidence: 0.9, language };
  }

  // Registration intent
  const registerKeywords = ['inscrire', 'inscription', 'enregistrer', 'nouveau', 'compte', 'bëgg'];
  if (registerKeywords.some(k => lowerMessage.includes(k))) {
    return { intent: 'register_landlord', confidence: 0.8, language };
  }

  // Check-in intent
  const checkinKeywords = ['locataire', 'client', 'arrivee', 'checkin', 'check-in', 'touriste', 'voyageur'];
  if (checkinKeywords.some(k => lowerMessage.includes(k))) {
    return { intent: 'checkin_guest', confidence: 0.8, language };
  }

  // Payment intent
  const paymentKeywords = ['payer', 'paiement', 'tpt', 'taxe', 'wave', 'fey', 'xaalis'];
  if (paymentKeywords.some(k => lowerMessage.includes(k))) {
    return { intent: 'payment', confidence: 0.8, language };
  }

  // Help intent
  const helpKeywords = ['aide', 'help', 'comment', 'question', 'probleme', 'ndimbal'];
  if (helpKeywords.some(k => lowerMessage.includes(k))) {
    return { intent: 'help', confidence: 0.8, language };
  }

  return { intent: 'unknown', confidence: 0.3, language };
}

// =============================================================================
// WOLOF RESPONSES
// =============================================================================

export const WOLOF_RESPONSES = {
  greeting: "Nanga def! Dalal ak jamm ci Gestoo. 👋 Man moom assistant bi, dama koy dimbal ak gestion ay propriete yi.",
  welcome_back: "Dalal ak jamm! Lan la bëgg def tay?",
  thank_you: "Jërëjëf! Bëgg nga ndimbal bu yeneen?",
  goodbye: "Ba beneen yoon! Yàlla na la yàbb.",
  help: "Mënuma la dimbal ak:\n1. Bindu propriete\n2. Enregistrer locataire\n3. Fey TPT ak Wave\n4. Wone tarixi yi",
  error: "Am na njuumte. Jëfandikul 'menu' ngir door.",
  understood: "Dégg naa. Jog!",
};

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  chat,
  analyzeDocument,
  detectLanguage,
  generateFlowResponse,
  detectIntent,
  WOLOF_RESPONSES,
};
