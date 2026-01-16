/**
 * Tax Advisor Flow Handler
 * Handles tax-related queries using RAG-based knowledge base
 */

import { getRelevantContext, isTaxRelatedQuery, SearchResult } from '../lib/knowledge-base';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Tax Advisor System Prompt
export const TAX_ADVISOR_SYSTEM_PROMPT = `Tu es un conseiller fiscal expert specialise dans la fiscalite immobiliere au Senegal.
Tu aides les bailleurs et proprietaires a comprendre leurs obligations concernant:
- La Taxe sur la Propriete Batie (TPT/CFPB)
- L'enregistrement des biens et contrats de bail
- Les declarations fiscales et plateformes en ligne (eTax)
- Les retenues a la source et autres taxes

Regles importantes:
1. Utilise les informations de la base de connaissances fournie pour repondre
2. Reponds dans la langue de l'utilisateur (francais, wolof, anglais)
3. Sois precis, cite les taux et delais exacts
4. Recommande de consulter un professionnel pour les cas complexes
5. Si tu n'as pas l'information, dis-le clairement plutot que d'inventer

Taux et delais de reference:
- TPT: 5% (habitation/commerce), 7.5% (industrie)
- Enregistrement bail: 2% du loyer annuel + charges
- Retenue source: 5% si loyer > 150 000 FCFA/mois
- TVA meublee: 18%
- Date limite TPT: 31 janvier
- Date limite revenus fonciers: 30 avril
- Penalite retard: 10% + 0.5%/mois`;

// Gemini client for tax advisor
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generate tax advisor response using Gemini
 */
export async function generateTaxAdvisorResponse(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${TAX_ADVISOR_SYSTEM_PROMPT}\n\n${prompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.3, // Lower temperature for more factual responses
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    });

    const response = result.response;
    return response.text() || 'Je suis desole, je n\'ai pas pu generer une reponse.';
  } catch (error) {
    console.error('Gemini tax advisor error:', error);
    throw error;
  }
}

// Types
export interface TaxAdvisorContext {
  sessionId: string;
  conversationHistory: Message[];
  lastQuery: string;
  lastFAQResults: SearchResult | null;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// In-memory session storage (in production, use Redis or database)
const taxAdvisorSessions: Map<string, TaxAdvisorContext> = new Map();

// Session TTL: 30 minutes
const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * Get or create a tax advisor session
 */
function getSession(sessionId: string): TaxAdvisorContext {
  let session = taxAdvisorSessions.get(sessionId);

  if (!session) {
    session = {
      sessionId,
      conversationHistory: [],
      lastQuery: '',
      lastFAQResults: null
    };
    taxAdvisorSessions.set(sessionId, session);
  }

  return session;
}

/**
 * Clean up old sessions
 */
function cleanupSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of taxAdvisorSessions.entries()) {
    const lastMessage = session.conversationHistory[session.conversationHistory.length - 1];
    if (lastMessage && now - lastMessage.timestamp.getTime() > SESSION_TTL_MS) {
      taxAdvisorSessions.delete(sessionId);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupSessions, 10 * 60 * 1000);

/**
 * Build conversation context for Gemini
 */
function buildConversationContext(session: TaxAdvisorContext, maxMessages: number = 6): string {
  const recentHistory = session.conversationHistory.slice(-maxMessages);

  if (recentHistory.length === 0) {
    return '';
  }

  const historyText = recentHistory.map(msg =>
    `${msg.role === 'user' ? 'Utilisateur' : 'Conseiller'}: ${msg.content}`
  ).join('\n\n');

  return `Historique de la conversation:\n${historyText}\n\n`;
}

/**
 * Detect user's language from message
 */
function detectLanguage(message: string): 'fr' | 'wo' | 'en' {
  const lowerMessage = message.toLowerCase();

  // Wolof indicators
  const wolofWords = ['nanga', 'def', 'jerejeuf', 'ndax', 'ndanka', 'degg', 'waaw', 'deedeet'];
  if (wolofWords.some(word => lowerMessage.includes(word))) {
    return 'wo';
  }

  // English indicators
  const englishWords = ['what', 'how', 'when', 'where', 'please', 'thank', 'help', 'need'];
  if (englishWords.some(word => lowerMessage.includes(word))) {
    return 'en';
  }

  // Default to French
  return 'fr';
}

/**
 * Get language-specific instructions
 */
function getLanguageInstructions(language: 'fr' | 'wo' | 'en'): string {
  switch (language) {
    case 'wo':
      return 'Reponds en Wolof simple et clair, en utilisant des termes fiscaux en francais quand necessaire.';
    case 'en':
      return 'Respond in English. Use French terms for specific tax concepts when there is no English equivalent.';
    default:
      return 'Reponds en francais clair et professionnel.';
  }
}

/**
 * Format the response for WhatsApp
 */
function formatWhatsAppResponse(response: string): string {
  // Limit response length for WhatsApp (max ~4000 chars recommended)
  const maxLength = 4000;

  if (response.length <= maxLength) {
    return response;
  }

  // Truncate and add continuation message
  const truncated = response.substring(0, maxLength - 100);
  const lastPeriod = truncated.lastIndexOf('.');
  const cutPoint = lastPeriod > maxLength * 0.7 ? lastPeriod + 1 : maxLength - 100;

  return `${response.substring(0, cutPoint)}\n\n_Tapez "suite" pour plus d'informations._`;
}

/**
 * Check if this is a follow-up request
 */
function isFollowUpRequest(message: string): boolean {
  const followUpPhrases = [
    'suite', 'continuer', 'plus', 'encore', 'detail',
    'continue', 'more', 'explain', 'clarify'
  ];

  const lowerMessage = message.toLowerCase().trim();
  return followUpPhrases.some(phrase => lowerMessage.includes(phrase));
}

/**
 * Main handler: Process tax-related query
 */
export async function handleTaxQuery(
  message: string,
  sessionId: string
): Promise<string> {
  try {
    const session = getSession(sessionId);
    const language = detectLanguage(message);

    // Check if this is a follow-up request
    if (isFollowUpRequest(message) && session.lastFAQResults) {
      // Use the same context for continuation
      const followUpPrompt = `L'utilisateur demande plus d'informations sur le sujet precedent: "${session.lastQuery}"

${session.lastFAQResults.context}

Message de l'utilisateur: ${message}

${getLanguageInstructions(language)}
Fournis des informations complementaires ou des clarifications.`;

      const response = await generateTaxAdvisorResponse(followUpPrompt);

      // Update session
      session.conversationHistory.push(
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: response, timestamp: new Date() }
      );

      return formatWhatsAppResponse(response);
    }

    // Search knowledge base for relevant FAQ entries
    const searchResult = await getRelevantContext(message);

    // Build the prompt for Gemini
    const conversationContext = buildConversationContext(session);
    const languageInstructions = getLanguageInstructions(language);

    let prompt: string;

    if (searchResult.entries.length > 0) {
      // We have relevant FAQ entries
      prompt = `${conversationContext}
${searchResult.context}

Question de l'utilisateur: ${message}

${languageInstructions}

Instructions:
- Base ta reponse sur les informations de la base de connaissances ci-dessus
- Sois precis avec les taux, delais et montants
- Si la question n'est pas couverte par la base de connaissances, indique-le clairement
- Recommande de consulter un professionnel pour les cas complexes
- Utilise des emojis avec parcimonie pour une meilleure lisibilite`;
    } else {
      // No FAQ entries found, general tax guidance
      prompt = `${conversationContext}
Question de l'utilisateur sur la fiscalite immobiliere au Senegal: ${message}

${languageInstructions}

Instructions:
- Tu es un conseiller fiscal expert en fiscalite immobiliere au Senegal
- Si tu n'as pas d'information precise, indique-le et recommande de contacter la DGID ou un expert-comptable
- Ne donne pas de conseils incorrects - il vaut mieux dire "je ne suis pas sur" que de donner une information fausse
- Fournis les coordonnees utiles si possible (eTax: etax.gouv.sn, DGID: dgid.gouv.sn)`;
    }

    // Generate response using Gemini
    const response = await generateTaxAdvisorResponse(prompt);

    // Update session
    session.lastQuery = message;
    session.lastFAQResults = searchResult;
    session.conversationHistory.push(
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: response, timestamp: new Date() }
    );

    // Keep conversation history manageable
    if (session.conversationHistory.length > 20) {
      session.conversationHistory = session.conversationHistory.slice(-12);
    }

    return formatWhatsAppResponse(response);

  } catch (error) {
    console.error('Tax advisor error:', error);

    // Return a helpful error message
    return `Desole, je n'ai pas pu traiter votre question. Veuillez reessayer ou contacter la DGID directement:

📞 Telephone: 33 889 20 20
🌐 Site web: etax.gouv.sn
📧 Email: support@etax.gouv.sn`;
  }
}

/**
 * Get quick help menu for tax topics
 */
export function getTaxHelpMenu(): string {
  return `🏛️ *Conseiller Fiscal - Menu d'Aide*

Choisissez un sujet ou posez votre question:

1️⃣ *TPT/CFPB* - Taxe sur la Propriete Batie
2️⃣ *Enregistrement* - Biens et contrats de bail
3️⃣ *Obligations* - Ce que doivent payer les bailleurs
4️⃣ *Declarations* - Delais et procedures
5️⃣ *Paiement* - Comment payer vos impots
6️⃣ *eTax* - Demarches en ligne
7️⃣ *Penalites* - Sanctions en cas de retard
8️⃣ *CGF* - Regime simplifie pour petits bailleurs

Tapez le numero ou posez directement votre question.

_Exemple: "Quel est le taux de la TPT ?"_`;
}

/**
 * Handle menu selection
 */
export async function handleMenuSelection(
  selection: string,
  sessionId: string
): Promise<string> {
  const menuQueries: Record<string, string> = {
    '1': "Qu'est-ce que la TPT et comment est-elle calculee ?",
    '2': "Comment enregistrer un bien immobilier et un contrat de bail ?",
    '3': "Quelles sont les obligations fiscales des bailleurs ?",
    '4': "Quels sont les delais de declaration des impots fonciers ?",
    '5': "Comment payer la TPT au Senegal ?",
    '6': "Comment utiliser la plateforme eTax ?",
    '7': "Quelles sont les penalites en cas de retard de paiement ?",
    '8': "Comment fonctionne la CGF (Contribution Globale Fonciere) ?"
  };

  const query = menuQueries[selection.trim()];

  if (query) {
    return handleTaxQuery(query, sessionId);
  }

  // Not a menu selection, treat as a regular query
  return handleTaxQuery(selection, sessionId);
}

/**
 * Check if message should be handled by tax advisor
 */
export function shouldHandleTaxQuery(message: string): boolean {
  return isTaxRelatedQuery(message);
}

/**
 * Clear session (for testing or user request)
 */
export function clearSession(sessionId: string): void {
  taxAdvisorSessions.delete(sessionId);
}

/**
 * Export for testing
 */
export const __testing = {
  getSession,
  taxAdvisorSessions,
  detectLanguage,
  buildConversationContext
};
