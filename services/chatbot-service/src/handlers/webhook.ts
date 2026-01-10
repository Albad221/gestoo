import { Request, Response } from 'express';
import { processMessage } from '../flows/router.js';
import { parseWatiWebhook, WatiWebhookPayload } from '../lib/wati.js';
import type { WhatsAppMessage } from '@gestoo/types';

/**
 * WATI Webhook Handler
 * Receives incoming messages from WATI and routes them to the appropriate flow
 */
export async function webhookHandler(req: Request, res: Response) {
  console.log('[WEBHOOK] ========== RAW PAYLOAD ==========');
  console.log('[WEBHOOK] Received request:', JSON.stringify(req.body, null, 2));
  console.log('[WEBHOOK] ================================');

  try {
    const payload = req.body as WatiWebhookPayload;

    // Acknowledge receipt immediately (WATI expects 200)
    res.sendStatus(200);

    // Skip if this is an outgoing message (from us)
    if (payload.owner === true) {
      console.log('[WEBHOOK] Skipping outgoing message (owner=true)');
      return;
    }

    // Only process actual message events, not status updates
    // WATI sends eventType: "message" for incoming messages
    // statusString can be "SENT", "DELIVERED", "READ" for status updates on OUR messages
    if (payload.eventType !== 'message') {
      console.log('[WEBHOOK] Skipping non-message event:', payload.eventType);
      return;
    }

    // Skip if no text content and no media
    if (!payload.text && !payload.data && payload.type === 'text') {
      console.log('[WEBHOOK] Skipping empty message');
      return;
    }

    // Parse the WATI payload into our standard format
    const message = parseWatiWebhook(payload);

    console.log(`[WATI] Received message from ${message.from}:`, {
      type: message.type,
      text: message.text?.body,
      hasImage: !!message.image,
      hasDocument: !!message.document,
    });

    // Process the message (cast to WhatsAppMessage as parsed message is compatible)
    await processMessage(message as unknown as WhatsAppMessage);

  } catch (error) {
    console.error('[WEBHOOK] Error processing message:', error);
    console.error('[WEBHOOK] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    // Don't send error response - we already sent 200
  }
}

/**
 * Webhook verification endpoint (for initial setup)
 */
export function webhookVerify(req: Request, res: Response) {
  // WATI doesn't require verification like Meta's webhook
  // But we can use this for health checks
  res.json({ status: 'ok', provider: 'wati' });
}

/**
 * Legacy Meta/360dialog webhook handler (keeping for reference)
 */
interface MetaWhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string };
          document?: { id: string; mime_type: string; filename: string };
          location?: { latitude: number; longitude: number };
          interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string };
          };
        }>;
      };
      field: string;
    }>;
  }>;
}

export async function metaWebhookHandler(req: Request, res: Response) {
  try {
    const payload = req.body as MetaWhatsAppWebhookPayload;

    // Acknowledge receipt immediately
    res.sendStatus(200);

    // Process messages asynchronously
    if (payload.object === 'whatsapp_business_account') {
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages' && change.value.messages) {
            for (const message of change.value.messages) {
              await processMessage({
                from: message.from,
                id: message.id,
                timestamp: message.timestamp,
                type: message.type as 'text' | 'image' | 'document' | 'location' | 'interactive',
                text: message.text,
                image: message.image,
                document: message.document,
                location: message.location,
                interactive: message.interactive as {
                  type: 'button_reply' | 'list_reply';
                  button_reply?: { id: string; title: string };
                  list_reply?: { id: string; title: string };
                },
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Meta webhook error:', error);
  }
}
