/**
 * Message Router
 * Routes incoming WhatsApp messages to the AI handler
 */

import type { WhatsAppMessage } from '@gestoo/types';
import { handleWithAI } from './ai-handler.js';
import { getSession } from '../lib/session.js';

/**
 * Process incoming WhatsApp message
 * Main entry point called by webhook handler
 */
export async function processMessage(message: WhatsAppMessage): Promise<void> {
  const phone = message.from;
  console.log(`[ROUTER] Processing message from ${phone}, type: ${message.type}`);

  // Get or create session for this user
  const session = await getSession(phone);

  // Route to AI handler which handles all message types including voice
  await handleWithAI(phone, message, session);
}
