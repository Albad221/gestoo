/**
 * Tax Router Integration
 * Provides tax intent detection and routing functions for the main router
 *
 * INTEGRATION INSTRUCTIONS:
 * Add to router.ts:
 *
 * import { isTaxQuery, routeTaxQuery } from './tax-router';
 *
 * // In your message handler:
 * if (isTaxQuery(message)) {
 *   return await routeTaxQuery(message, sessionId);
 * }
 */

import {
  handleTaxQuery,
  handleMenuSelection,
  getTaxHelpMenu,
  shouldHandleTaxQuery
} from './tax-advisor';
import { normalizeText } from '../lib/knowledge-base';

// Tax-related keywords for intent detection
const TAX_KEYWORDS = [
  // French tax terms
  'taxe', 'tpt', 'impot', 'foncier', 'bailleur', 'loyer',
  'propriete', 'contribution', 'cfpb', 'cgf', 'etax',
  'declaration', 'enregistrement', 'bail', 'locataire',
  'fiscale', 'fiscal', 'payer', 'penalite', 'amende',
  'revenus fonciers', 'location', 'immobilier',
  'dgid', 'tresor', 'quittance', 'attestation',
  // Additional terms
  'landlord', 'tax', 'property', 'rent', 'lease',
  'propriétaire', 'impôt', 'déclaration', 'pénalité',
  // Wolof terms (if any common)
  'wurus', 'kër'
];

// Menu trigger keywords
const MENU_KEYWORDS = [
  'menu', 'aide', 'help', 'fiscal', 'conseiller',
  'tax help', 'tax menu', 'aide fiscale',
  'conseiller fiscal', 'question fiscale'
];

/**
 * Check if the message is a tax-related query
 */
export function isTaxQuery(message: string): boolean {
  const normalizedMessage = normalizeText(message);

  // Check for tax keywords
  const hasTaxKeyword = TAX_KEYWORDS.some(keyword =>
    normalizedMessage.includes(normalizeText(keyword))
  );

  // Also use the knowledge base's detection
  return hasTaxKeyword || shouldHandleTaxQuery(message);
}

/**
 * Check if user is requesting the tax help menu
 */
export function isTaxMenuRequest(message: string): boolean {
  const normalizedMessage = normalizeText(message);

  return MENU_KEYWORDS.some(keyword =>
    normalizedMessage.includes(normalizeText(keyword))
  );
}

/**
 * Check if the message is a menu selection (1-8)
 */
export function isMenuSelection(message: string): boolean {
  const trimmed = message.trim();
  return /^[1-8]$/.test(trimmed);
}

/**
 * Route tax-related queries to appropriate handlers
 */
export async function routeTaxQuery(
  message: string,
  sessionId: string
): Promise<string> {
  // Check if requesting menu
  if (isTaxMenuRequest(message)) {
    return getTaxHelpMenu();
  }

  // Check if it's a menu selection
  if (isMenuSelection(message)) {
    return handleMenuSelection(message, sessionId);
  }

  // Handle regular tax query
  return handleTaxQuery(message, sessionId);
}

/**
 * Get the tax help intro message (can be used for first-time users)
 */
export function getTaxIntroMessage(): string {
  return `🏛️ *Bienvenue au Service de Conseil Fiscal*

Je suis votre assistant fiscal specialise dans la fiscalite immobiliere au Senegal. Je peux vous aider avec:

• La Taxe sur la Propriete Batie (TPT/CFPB)
• L'enregistrement des biens et baux
• Les obligations des bailleurs
• Les declarations et delais
• Les plateformes en ligne (eTax)

Posez-moi votre question ou tapez *menu* pour voir les sujets disponibles.

_Exemple: "Comment calculer la TPT ?"_`;
}

/**
 * Export for use in main router
 */
export {
  handleTaxQuery,
  handleMenuSelection,
  getTaxHelpMenu
};
