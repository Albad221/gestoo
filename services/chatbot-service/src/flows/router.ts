/**
 * Message Router
 *
 * Simple router that delegates everything to the AI handler.
 * The AI (Gemini 3 Flash) handles all conversation flows naturally.
 */

import type { WhatsAppMessage } from '@gestoo/types';
import { getSession } from '../lib/session.js';
import { handleWithAI } from './ai-handler.js';

export async function processMessage(message: WhatsAppMessage): Promise<void> {
  const phone = message.from;
  console.log(`[ROUTER] Processing message from ${phone}, type: ${message.type}`);

  // Get or create session
  const session = await getSession(phone);
  console.log(`[ROUTER] Session state: ${session.state}, landlord_id: ${session.landlord_id || 'none'}`);

  // Let AI handle everything
  await handleWithAI(phone, message, session);
}
