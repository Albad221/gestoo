/**
 * Message Router
 * Routes incoming WhatsApp messages to appropriate flow handlers
 */

import type { WhatsAppMessage, ChatbotSession } from '@gestoo/types';
import { handleWithAI } from './ai-handler.js';
import { getOrCreateSession } from '../lib/session.js';

/**
 * Process incoming WhatsApp message
 * Main entry point called by webhook handler
 */
export async function processMessage(message: WhatsAppMessage): Promise<void> {
  const phone = message.from;
  console.log(`[ROUTER] Processing message from ${phone}, type: ${message.type}`);

  // Get or create session for this user
  const session = await getOrCreateSession(phone);

  // Route to AI handler which handles all message types including voice
  await handleWithAI(phone, message, session);
}

export interface RouterContext {
  phoneNumber: string;
  sessionId: string;
  userMessage: string;
  mediaUrl?: string;
}

export interface RouterResult {
  response: string;
  flowType: string;
}

/**
 * Main router function - routes messages to appropriate handlers
 */
export async function routeMessage(ctx: RouterContext): Promise<RouterResult> {
  const { phoneNumber, sessionId, userMessage, mediaUrl } = ctx;
  const message = userMessage.trim().toLowerCase();

  try {
    // Priority 1: Check for active flows (onboarding, checkin, payment)
    if (await isOnboardingFlow(sessionId)) {
      const response = await handleOnboarding(userMessage, sessionId, phoneNumber);
      return { response, flowType: 'onboarding' };
    }

    if (await isGuestCheckinFlow(sessionId)) {
      const response = await handleGuestCheckin(userMessage, sessionId, phoneNumber, mediaUrl);
      return { response, flowType: 'guest-checkin' };
    }

    if (await isPaymentFlow(sessionId)) {
      const response = await handlePayment(userMessage, sessionId, phoneNumber);
      return { response, flowType: 'payment' };
    }

    if (await isPropertyFlow(sessionId)) {
      const response = await handleProperty(userMessage, sessionId, phoneNumber);
      return { response, flowType: 'property' };
    }

    // Priority 2: Check for flow triggers

    // Tax/Fiscal queries
    if (isTaxQuery(userMessage)) {
      const response = await routeTaxQuery(userMessage, sessionId);
      return { response, flowType: 'tax-advisor' };
    }

    // Onboarding triggers
    if (isOnboardingTrigger(message)) {
      const response = await handleOnboarding(userMessage, sessionId, phoneNumber);
      return { response, flowType: 'onboarding' };
    }

    // Guest checkin triggers
    if (isCheckinTrigger(message)) {
      const response = await handleGuestCheckin(userMessage, sessionId, phoneNumber, mediaUrl);
      return { response, flowType: 'guest-checkin' };
    }

    // Payment triggers
    if (isPaymentTrigger(message)) {
      const response = await handlePayment(userMessage, sessionId, phoneNumber);
      return { response, flowType: 'payment' };
    }

    // Property triggers
    if (isPropertyTrigger(message)) {
      const response = await handleProperty(userMessage, sessionId, phoneNumber);
      return { response, flowType: 'property' };
    }

    // Priority 3: General AI handler for unmatched queries
    const response = await handleAIMessage(userMessage, sessionId);
    return { response, flowType: 'ai-general' };

  } catch (error) {
    console.error('Router error:', error);
    return {
      response: getErrorMessage(),
      flowType: 'error'
    };
  }
}

/**
 * Check if message triggers onboarding flow
 */
function isOnboardingTrigger(message: string): boolean {
  const triggers = [
    'inscription', 'inscrire', 'register', 'nouveau', 'commencer',
    'start', 'debut', 'hello', 'bonjour', 'salut', 'hi'
  ];
  return triggers.some(t => message.includes(t));
}

/**
 * Check if message triggers guest checkin flow
 */
function isCheckinTrigger(message: string): boolean {
  const triggers = [
    'checkin', 'check-in', 'arrivee', 'guest', 'voyageur',
    'enregistrer voyageur', 'nouveau voyageur', 'declaration police'
  ];
  return triggers.some(t => message.includes(t));
}

/**
 * Check if message triggers payment flow
 */
function isPaymentTrigger(message: string): boolean {
  const triggers = [
    'payer', 'payment', 'paiement', 'facture', 'recu',
    'orange money', 'wave', 'om'
  ];
  return triggers.some(t => message.includes(t));
}

/**
 * Check if message triggers property flow
 */
function isPropertyTrigger(message: string): boolean {
  const triggers = [
    'propriete', 'property', 'bien', 'logement', 'appartement',
    'maison', 'ajouter bien', 'nouveau bien'
  ];
  return triggers.some(t => message.includes(t));
}

/**
 * Get error message in French
 */
function getErrorMessage(): string {
  return `Désolé, une erreur s'est produite. Veuillez réessayer.

Si le problème persiste, contactez notre support:
📧 support@gestoo.sn`;
}

/**
 * Get welcome message for new users
 */
export function getWelcomeMessage(): string {
  return `👋 *Bienvenue sur Gestoo!*

Je suis votre assistant pour la gestion de vos locations et obligations fiscales au Sénégal.

Comment puis-je vous aider ?

1️⃣ *Inscription* - Créer un compte bailleur
2️⃣ *Check-in* - Enregistrer un voyageur
3️⃣ *Paiement* - Payer vos taxes
4️⃣ *Fiscal* - Questions sur la TPT/impôts

Tapez le numéro ou décrivez votre besoin.`;
}

/**
 * Export for external use
 */
export { isTaxQuery, routeTaxQuery, getTaxIntroMessage };
