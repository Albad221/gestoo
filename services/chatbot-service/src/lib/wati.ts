/**
 * WATI WhatsApp Business API Client
 * Production-ready implementation with full message types, webhook handling,
 * error handling, retries, and rate limiting.
 *
 * Official Documentation: https://docs.wati.io/reference/introduction
 * API Guide: https://support.wati.io/en/articles/11462487-wati-api-guide
 * Webhooks: https://docs.wati.io/reference/webhooks
 */

import crypto from 'crypto';

// =============================================================================
// CONFIGURATION
// =============================================================================

const WATI_API_URL = process.env.WATI_API_URL || 'https://live-mt-server.wati.io/384776';
const WATI_API_TOKEN = process.env.WATI_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6ImFsYmFkQGFuZGFraWEudGVjaCIsIm5hbWVpZCI6ImFsYmFkQGFuZGFraWEudGVjaCIsImVtYWlsIjoiYWxiYWRAYW5kYWtpYS50ZWNoIiwiYXV0aF90aW1lIjoiMDkvMTEvMjAyNSAxNzozMToxNCIsInRlbmFudF9pZCI6IjM4NDc3NiIsImp0aSI6Ijc0MjhlYzhiLTY3ZjctNDc1Mi04NDM5LTliODAwZGJlMWNlMiIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.zapQ2qUVLm8CBrkhbkfuRpNzqYhc0zOjs0v9SC32oMs';
const WATI_WEBHOOK_SECRET = process.env.WATI_WEBHOOK_SECRET || '';

// Rate limiting configuration based on WATI plan tiers
// Growth: 30 req/10sec, Pro: 60 req/10sec, Business: 100 req/10sec
const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.WATI_RATE_LIMIT || '30', 10);

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

// API Response Types
export interface WatiResponse<T = any> {
  result: boolean;
  info?: string;
  data?: T;
}

export interface WatiTemplateResponse {
  result: boolean;
  templateName?: string;
  receivers?: Array<{
    localMessageId: string;
    waId: string;
    isValidWhatsAppNumber: boolean;
    errors?: string[];
  }>;
}

export interface WatiMessageResponse {
  result: boolean;
  messageId?: string;
  localMessageId?: string;
}

// Interactive Message Types
export interface InteractiveButton {
  id: string;
  title: string;
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

// Media Types
export interface MediaHeader {
  type: 'image' | 'video' | 'document';
  url: string;
  fileName?: string;
}

// Template Parameter Types
export interface TemplateParameter {
  name: string;
  value: string;
}

export interface TemplateOptions {
  templateName: string;
  broadcastName?: string;
  parameters?: TemplateParameter[];
  mediaHeader?: MediaHeader;
  buttonParameters?: Array<{
    index: number;
    type: 'url' | 'payload';
    value: string;
  }>;
}

// Contact Types
export interface ContactAttribute {
  name: string;
  value: string;
}

export interface Contact {
  id: string;
  waId: string;
  name: string;
  phone: string;
  created: string;
  customParams: ContactAttribute[];
}

// Webhook Types
export type WebhookMessageType =
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'location'
  | 'interactive'
  | 'button'
  | 'sticker'
  | 'contacts'
  | 'voice'
  | 'reaction'
  | 'order'
  | 'catalog'
  | 'media_placeholder';

export interface WatiWebhookPayload {
  id: string;
  created: string;
  whatsappMessageId: string;
  conversationId: string;
  ticketId: string;
  text: string;
  type: WebhookMessageType;
  data?: string; // JSON string for media/location data
  sourceId?: string;
  sourceUrl?: string;
  timestamp: string;
  owner: boolean;
  eventType?: string;
  statusString: string;
  avatarUrl?: string;
  assignedId?: string;
  operatorName?: string;
  operatorEmail?: string;
  waId: string; // Phone number without + prefix
  messageContact?: any;
  senderName: string;
  listReply?: {
    title: string;
    id: string;
    description: string;
  };
  interactiveButtonReply?: {
    id: string;
    title: string;
  };
  buttonReply?: {
    id: string;
    title: string;
  };
  replyContextId?: string;
  sourceType?: number;
  frequentlyForwarded?: boolean;
  forwarded?: boolean;
  channelId?: string;
  channelPhoneNumber?: string;
}

export interface WatiTemplateStatusWebhook {
  localMessageId: string;
  whatsappMessageId: string;
  waId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  failedCode?: string;
  failedDetail?: string;
}

// Parsed Message Types
export interface ParsedMessage {
  from: string;
  id: string;
  whatsappMessageId: string;
  timestamp: string;
  type: WebhookMessageType;
  text?: { body: string };
  image?: { id: string; url: string; mimeType: string; caption?: string };
  document?: { id: string; url: string; mimeType: string; filename: string; caption?: string };
  audio?: { id: string; url: string; mimeType: string };
  video?: { id: string; url: string; mimeType: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  sticker?: { id: string; url: string };
  contacts?: Array<{
    name: { formattedName: string; firstName?: string; lastName?: string };
    phones: Array<{ phone: string; type?: string }>;
  }>;
  reaction?: { messageId: string; emoji: string };
  senderName: string;
  conversationId: string;
  ticketId: string;
  isForwarded: boolean;
  replyToMessageId?: string;
}

// Error Types
export class WatiApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'WatiApiError';
  }
}

export class WatiRateLimitError extends WatiApiError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, undefined, true);
    this.name = 'WatiRateLimitError';
  }
}

// =============================================================================
// RATE LIMITER
// =============================================================================

class RateLimiter {
  private requests: number[] = [];
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = RATE_LIMIT_WINDOW_MS, maxRequests: number = RATE_LIMIT_MAX_REQUESTS) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove expired timestamps
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      // Calculate wait time until oldest request expires
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100; // Add 100ms buffer

      console.log(`Rate limit reached. Waiting ${waitTime}ms before next request.`);
      await this.sleep(waitTime);

      // Recursively try again after waiting
      return this.acquire();
    }

    this.requests.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit status
   */
  getStatus(): { remaining: number; resetMs: number } {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    const remaining = Math.max(0, this.maxRequests - this.requests.length);
    const resetMs = this.requests.length > 0
      ? this.windowMs - (now - this.requests[0])
      : 0;

    return { remaining, resetMs };
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

// =============================================================================
// HTTP CLIENT WITH RETRIES
// =============================================================================

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  body?: object;
  queryParams?: Record<string, string>;
  isFormData?: boolean;
  skipRateLimit?: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateBackoff(attempt: number): number {
  const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(delay + jitter, MAX_RETRY_DELAY_MS);
}

async function watiRequest<T = any>(options: RequestOptions): Promise<T> {
  const { method, endpoint, body, queryParams, isFormData, skipRateLimit } = options;

  // Apply rate limiting
  if (!skipRateLimit) {
    await rateLimiter.acquire();
  }

  // Build URL with query parameters
  let url = `${WATI_API_URL}/api/v1/${endpoint}`;
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${WATI_API_TOKEN}`,
      };

      let requestBody: string | FormData | undefined;

      if (body && !isFormData) {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      } else if (body && isFormData) {
        // FormData sets its own Content-Type with boundary
        requestBody = body as unknown as FormData;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: requestBody,
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : calculateBackoff(attempt);

        console.warn(`WATI API rate limited (429). Waiting ${waitTime}ms before retry ${attempt + 1}/${MAX_RETRIES}`);

        if (attempt < MAX_RETRIES) {
          await sleep(waitTime);
          continue;
        }

        throw new WatiRateLimitError('Rate limit exceeded after maximum retries');
      }

      // Handle other errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;

        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        // Determine if error is retryable
        const retryable = response.status >= 500 || response.status === 408;

        if (retryable && attempt < MAX_RETRIES) {
          const backoff = calculateBackoff(attempt);
          console.warn(`WATI API error ${response.status}. Retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(backoff);
          continue;
        }

        throw new WatiApiError(
          `WATI API error: ${response.status} - ${errorData.message || errorText}`,
          response.status,
          errorData,
          retryable
        );
      }

      // Parse successful response
      const contentType = response.headers.get('Content-Type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }

      // Return raw response for binary data
      return await response.arrayBuffer() as unknown as T;

    } catch (error) {
      lastError = error as Error;

      // Don't retry on non-retryable errors
      if (error instanceof WatiApiError && !error.retryable) {
        throw error;
      }

      // Network errors - retry
      if (attempt < MAX_RETRIES && !(error instanceof WatiApiError)) {
        const backoff = calculateBackoff(attempt);
        console.warn(`Network error. Retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES}): ${(error as Error).message}`);
        await sleep(backoff);
        continue;
      }
    }
  }

  throw lastError || new Error('Unknown error occurred');
}

// =============================================================================
// MESSAGE SENDING FUNCTIONS
// =============================================================================

/**
 * Sanitize phone number - WATI expects phone without + prefix
 */
function sanitizePhone(phone: string): string {
  return phone.replace(/^\+/, '').replace(/\s/g, '');
}

/**
 * Send a text message within an active session (24-hour window)
 *
 * @param to - Recipient phone number
 * @param text - Message text (max 4096 characters)
 * @returns Message response with local message ID
 */
export async function sendMessage(to: string, text: string): Promise<WatiMessageResponse> {
  const phone = sanitizePhone(to);

  // WhatsApp has a 4096 character limit for text messages
  const truncatedText = text.substring(0, 4096);

  console.log(`[WATI] Sending message to ${phone}: "${truncatedText.substring(0, 50)}..."`);

  const result = await watiRequest<WatiMessageResponse>({
    method: 'POST',
    endpoint: `sendSessionMessage/${phone}`,
    queryParams: { messageText: truncatedText },
  });

  console.log(`[WATI] sendMessage result:`, JSON.stringify(result));
  return result;
}

/**
 * Send a text message (alias for sendMessage)
 */
export const sendTextMessage = sendMessage;

/**
 * Send an image message within an active session
 *
 * @param to - Recipient phone number
 * @param imageUrl - URL of the image (must be publicly accessible)
 * @param caption - Optional caption (max 1024 characters)
 */
export async function sendImage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<WatiMessageResponse> {
  const phone = sanitizePhone(to);

  return watiRequest<WatiMessageResponse>({
    method: 'POST',
    endpoint: `sendSessionFile/${phone}`,
    queryParams: caption ? { caption: caption.substring(0, 1024) } : undefined,
    body: { url: imageUrl },
  });
}

/**
 * Send a document message within an active session
 *
 * @param to - Recipient phone number
 * @param documentUrl - URL of the document (must be publicly accessible)
 * @param filename - Document filename
 * @param caption - Optional caption
 */
export async function sendDocument(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
): Promise<WatiMessageResponse> {
  const phone = sanitizePhone(to);

  return watiRequest<WatiMessageResponse>({
    method: 'POST',
    endpoint: `sendSessionFile/${phone}`,
    queryParams: caption ? { caption: caption.substring(0, 1024) } : undefined,
    body: {
      url: documentUrl,
      filename: filename || 'document',
    },
  });
}

/**
 * Send a video message within an active session
 *
 * @param to - Recipient phone number
 * @param videoUrl - URL of the video (must be publicly accessible)
 * @param caption - Optional caption
 */
export async function sendVideo(
  to: string,
  videoUrl: string,
  caption?: string
): Promise<WatiMessageResponse> {
  const phone = sanitizePhone(to);

  return watiRequest<WatiMessageResponse>({
    method: 'POST',
    endpoint: `sendSessionFile/${phone}`,
    queryParams: caption ? { caption: caption.substring(0, 1024) } : undefined,
    body: { url: videoUrl },
  });
}

/**
 * Send an audio message within an active session
 *
 * @param to - Recipient phone number
 * @param audioUrl - URL of the audio file (must be publicly accessible)
 */
export async function sendAudio(to: string, audioUrl: string): Promise<WatiMessageResponse> {
  const phone = sanitizePhone(to);
  console.log(`[WATI] sendAudio to ${phone}, URL: ${audioUrl}`);

  const result = await watiRequest<WatiMessageResponse>({
    method: 'POST',
    endpoint: `sendSessionFile/${phone}`,
    body: { url: audioUrl },
  });

  console.log(`[WATI] sendAudio result:`, JSON.stringify(result));
  return result;
}

/**
 * Send a media message (generic function for image, document, audio, video)
 *
 * @param to - Recipient phone number
 * @param mediaUrl - URL of the media file
 * @param caption - Optional caption
 * @param filename - Optional filename for documents
 */
export async function sendMedia(
  to: string,
  mediaUrl: string,
  caption?: string,
  filename?: string
): Promise<WatiMessageResponse> {
  const phone = sanitizePhone(to);

  const body: Record<string, string> = { url: mediaUrl };
  if (filename) {
    body.filename = filename;
  }

  return watiRequest<WatiMessageResponse>({
    method: 'POST',
    endpoint: `sendSessionFile/${phone}`,
    queryParams: caption ? { caption: caption.substring(0, 1024) } : undefined,
    body,
  });
}

/**
 * Send a location message
 *
 * @param to - Recipient phone number
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @param name - Optional location name
 * @param address - Optional address
 */
export async function sendLocation(
  to: string,
  latitude: number,
  longitude: number,
  name?: string,
  address?: string
): Promise<WatiMessageResponse> {
  const phone = sanitizePhone(to);

  return watiRequest<WatiMessageResponse>({
    method: 'POST',
    endpoint: 'sendLocationMessage',
    queryParams: { whatsappNumber: phone },
    body: {
      latitude,
      longitude,
      name: name || '',
      address: address || '',
    },
  });
}

// =============================================================================
// INTERACTIVE MESSAGES
// =============================================================================

/**
 * Send interactive buttons message (max 3 buttons)
 *
 * @param to - Recipient phone number
 * @param bodyText - Message body text
 * @param buttons - Array of buttons (max 3)
 * @param options - Optional header, footer, and header media
 */
export async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: InteractiveButton[],
  options?: {
    headerText?: string;
    footerText?: string;
    headerMedia?: MediaHeader;
  }
): Promise<WatiMessageResponse> {
  const phone = sanitizePhone(to);

  // WhatsApp limits: max 3 buttons, max 20 chars per button title
  const formattedButtons = buttons.slice(0, 3).map(btn => ({
    text: btn.title.substring(0, 20),
    payload: btn.id,
  }));

  const body: Record<string, any> = {
    body: bodyText.substring(0, 1024),
    buttons: formattedButtons,
  };

  if (options?.headerText) {
    body.header = {
      type: 'text',
      text: options.headerText.substring(0, 60),
    };
  } else if (options?.headerMedia) {
    body.header = {
      type: options.headerMedia.type,
      media: {
        url: options.headerMedia.url,
        fileName: options.headerMedia.fileName,
      },
    };
  }

  if (options?.footerText) {
    body.footer = options.footerText.substring(0, 60);
  }

  return watiRequest<WatiMessageResponse>({
    method: 'POST',
    endpoint: 'sendInteractiveButtonsMessage',
    queryParams: { whatsappNumber: phone },
    body,
  });
}

/**
 * Send interactive list message
 *
 * @param to - Recipient phone number
 * @param headerText - Header text
 * @param bodyText - Body text
 * @param buttonText - Button text to open list (max 20 chars)
 * @param sections - List sections with rows
 * @param footerText - Optional footer text
 */
export async function sendInteractiveList(
  to: string,
  headerText: string,
  bodyText: string,
  buttonText: string,
  sections: ListSection[],
  footerText?: string
): Promise<WatiMessageResponse> {
  const phone = sanitizePhone(to);

  // Format sections with WhatsApp limits
  const formattedSections = sections.map(section => ({
    title: section.title.substring(0, 24),
    rows: section.rows.map(row => ({
      rowId: row.id,
      title: row.title.substring(0, 24),
      description: row.description?.substring(0, 72) || '',
    })),
  }));

  return watiRequest<WatiMessageResponse>({
    method: 'POST',
    endpoint: 'sendInteractiveListMessage',
    queryParams: { whatsappNumber: phone },
    body: {
      header: headerText.substring(0, 60),
      body: bodyText.substring(0, 1024),
      footer: footerText?.substring(0, 60) || '',
      buttonText: buttonText.substring(0, 20),
      sections: formattedSections,
    },
  });
}

// =============================================================================
// TEMPLATE MESSAGES
// =============================================================================

/**
 * Send a template message
 * Templates must be pre-approved by WhatsApp. Use for notifications outside 24-hour window.
 *
 * @param to - Recipient phone number
 * @param options - Template options including name, parameters, and media header
 */
export async function sendTemplate(
  to: string,
  options: TemplateOptions
): Promise<WatiTemplateResponse> {
  const phone = sanitizePhone(to);

  const body: Record<string, any> = {
    template_name: options.templateName,
    broadcast_name: options.broadcastName || 'api_broadcast',
  };

  // Add parameters if provided
  if (options.parameters && options.parameters.length > 0) {
    body.parameters = options.parameters;
  }

  // Add media header for templates with image/video/document headers
  if (options.mediaHeader) {
    // Media URL should be passed as a parameter with the placeholder name from template
    // The parameter name must match what's defined in the template header
    if (!body.parameters) {
      body.parameters = [];
    }
    body.parameters.push({
      name: 'header_media',
      value: options.mediaHeader.url,
    });
  }

  // Add button parameters for dynamic URL buttons or quick reply payloads
  if (options.buttonParameters && options.buttonParameters.length > 0) {
    body.buttonParameters = options.buttonParameters.map(bp => ({
      index: bp.index,
      type: bp.type,
      value: bp.value,
    }));
  }

  return watiRequest<WatiTemplateResponse>({
    method: 'POST',
    endpoint: 'sendTemplateMessage',
    queryParams: { whatsappNumber: phone },
    body,
  });
}

/**
 * Send template message with simple parameters (convenience function)
 *
 * @param to - Recipient phone number
 * @param templateName - Template name
 * @param parameters - Array of parameter values in order
 */
export async function sendSimpleTemplate(
  to: string,
  templateName: string,
  parameters?: string[]
): Promise<WatiTemplateResponse> {
  const params: TemplateParameter[] = parameters?.map((value, index) => ({
    name: `${index + 1}`,
    value,
  })) || [];

  return sendTemplate(to, {
    templateName,
    parameters: params,
  });
}

/**
 * Send template message to multiple recipients (bulk)
 *
 * @param recipients - Array of recipients with phone and custom parameters
 * @param templateName - Template name
 * @param broadcastName - Name for the broadcast
 */
export async function sendBulkTemplate(
  recipients: Array<{
    phone: string;
    parameters?: TemplateParameter[];
  }>,
  templateName: string,
  broadcastName: string
): Promise<WatiTemplateResponse> {
  const receivers = recipients.map(r => ({
    whatsappNumber: sanitizePhone(r.phone),
    customParams: r.parameters || [],
  }));

  return watiRequest<WatiTemplateResponse>({
    method: 'POST',
    endpoint: 'sendTemplateMessages',
    body: {
      template_name: templateName,
      broadcast_name: broadcastName,
      receivers,
    },
  });
}

/**
 * Send template with image header
 */
export async function sendTemplateWithImage(
  to: string,
  templateName: string,
  imageUrl: string,
  parameters?: TemplateParameter[]
): Promise<WatiTemplateResponse> {
  return sendTemplate(to, {
    templateName,
    parameters: [
      ...(parameters || []),
      { name: 'header_image', value: imageUrl },
    ],
  });
}

/**
 * Send template with document header
 */
export async function sendTemplateWithDocument(
  to: string,
  templateName: string,
  documentUrl: string,
  parameters?: TemplateParameter[]
): Promise<WatiTemplateResponse> {
  return sendTemplate(to, {
    templateName,
    parameters: [
      ...(parameters || []),
      { name: 'header_document', value: documentUrl },
    ],
  });
}

// =============================================================================
// MEDIA HANDLING
// =============================================================================

/**
 * Download media from WATI by filename/ID
 *
 * @param fileName - Media file name or ID from webhook payload
 * @returns Buffer containing the media data
 */
export async function downloadMedia(fileName: string): Promise<Buffer> {
  const response = await watiRequest<ArrayBuffer>({
    method: 'GET',
    endpoint: 'getMedia',
    queryParams: { fileName },
  });

  return Buffer.from(response);
}

/**
 * Get media URL for a file
 *
 * @param fileName - Media file name or ID
 * @returns Direct URL to the media file
 */
export function getMediaUrl(fileName: string): string {
  return `${WATI_API_URL}/api/v1/getMedia?fileName=${encodeURIComponent(fileName)}`;
}

/**
 * Download media from a direct URL
 *
 * @param url - Direct URL to the media file
 * @returns Buffer containing the media data
 */
export async function downloadMediaFromUrl(url: string): Promise<Buffer> {
  console.log('[WATI] Downloading media from URL:', url);

  // Check if this is a WATI API URL or external URL (WhatsApp CDN)
  const isWatiUrl = url.includes('wati.io') || url.includes(WATI_API_URL || '');

  const headers: Record<string, string> = {};
  if (isWatiUrl) {
    headers['Authorization'] = `Bearer ${WATI_API_TOKEN}`;
  }

  console.log('[WATI] Using auth:', isWatiUrl);

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[WATI] Download failed:', response.status, errorText);
    throw new WatiApiError(
      `Failed to download media: ${response.status}`,
      response.status,
      { message: errorText },
      false
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  console.log('[WATI] Downloaded', arrayBuffer.byteLength, 'bytes');
  return Buffer.from(arrayBuffer);
}

// =============================================================================
// CONTACT MANAGEMENT
// =============================================================================

/**
 * Get contact information by phone number
 *
 * @param phone - Phone number to look up
 */
export async function getContact(phone: string): Promise<Contact | null> {
  const cleanPhone = sanitizePhone(phone);

  const response = await watiRequest<{
    result: boolean;
    contact_list: Contact[];
  }>({
    method: 'GET',
    endpoint: 'getContacts',
    queryParams: {
      pageSize: '1',
      pageNumber: '1',
      whatsappNumber: cleanPhone,
    },
    skipRateLimit: true, // Lower priority endpoint
  });

  return response.contact_list?.[0] || null;
}

/**
 * Add a new contact
 *
 * @param phone - Phone number
 * @param name - Contact name
 * @param attributes - Custom attributes
 */
export async function addContact(
  phone: string,
  name: string,
  attributes?: Record<string, string>
): Promise<WatiResponse> {
  const cleanPhone = sanitizePhone(phone);

  const customParams = attributes
    ? Object.entries(attributes).map(([name, value]) => ({ name, value }))
    : [];

  return watiRequest<WatiResponse>({
    method: 'POST',
    endpoint: `addContact/${cleanPhone}`,
    body: {
      name,
      customParams,
    },
  });
}

/**
 * Update contact attributes
 *
 * @param phone - Phone number
 * @param attributes - Attributes to update
 */
export async function updateContactAttributes(
  phone: string,
  attributes: Record<string, string>
): Promise<WatiResponse> {
  const cleanPhone = sanitizePhone(phone);

  const customParams = Object.entries(attributes).map(([name, value]) => ({
    name,
    value,
  }));

  return watiRequest<WatiResponse>({
    method: 'POST',
    endpoint: `updateContactAttributes/${cleanPhone}`,
    body: { customParams },
  });
}

/**
 * Get all contacts with pagination
 *
 * @param pageSize - Number of contacts per page
 * @param pageNumber - Page number (1-indexed)
 * @param filters - Optional filters
 */
export async function getContacts(
  pageSize: number = 20,
  pageNumber: number = 1,
  filters?: {
    name?: string;
    attribute?: string;
    createdDate?: string;
  }
): Promise<{ contacts: Contact[]; total: number }> {
  const queryParams: Record<string, string> = {
    pageSize: pageSize.toString(),
    pageNumber: pageNumber.toString(),
  };

  if (filters?.name) queryParams.name = filters.name;
  if (filters?.attribute) queryParams.attribute = filters.attribute;
  if (filters?.createdDate) queryParams.createdDate = filters.createdDate;

  const response = await watiRequest<{
    result: boolean;
    contact_list: Contact[];
    total: number;
  }>({
    method: 'GET',
    endpoint: 'getContacts',
    queryParams,
    skipRateLimit: true,
  });

  return {
    contacts: response.contact_list || [],
    total: response.total || 0,
  };
}

// =============================================================================
// CHAT MANAGEMENT
// =============================================================================

/**
 * Assign chat to an operator
 *
 * @param phone - Phone number of the conversation
 * @param operatorEmail - Email of the operator to assign
 */
export async function assignOperator(
  phone: string,
  operatorEmail: string
): Promise<WatiResponse> {
  const cleanPhone = sanitizePhone(phone);

  return watiRequest<WatiResponse>({
    method: 'POST',
    endpoint: 'assignOperator',
    queryParams: {
      whatsappNumber: cleanPhone,
      email: operatorEmail,
    },
  });
}

/**
 * Get messages for a conversation
 *
 * @param phone - Phone number
 * @param pageSize - Number of messages per page
 * @param pageNumber - Page number
 */
export async function getMessages(
  phone: string,
  pageSize: number = 20,
  pageNumber: number = 1
): Promise<any[]> {
  const cleanPhone = sanitizePhone(phone);

  const response = await watiRequest<{
    result: boolean;
    messages: any[];
  }>({
    method: 'GET',
    endpoint: `getMessages/${cleanPhone}`,
    queryParams: {
      pageSize: pageSize.toString(),
      pageNumber: pageNumber.toString(),
    },
    skipRateLimit: true,
  });

  return response.messages || [];
}

/**
 * Get available message templates
 *
 * @param pageSize - Number of templates per page
 * @param pageNumber - Page number
 */
export async function getMessageTemplates(
  pageSize: number = 100,
  pageNumber: number = 1
): Promise<any[]> {
  const response = await watiRequest<{
    result: boolean;
    messageTemplates: any[];
  }>({
    method: 'GET',
    endpoint: 'getMessageTemplates',
    queryParams: {
      pageSize: pageSize.toString(),
      pageNumber: pageNumber.toString(),
    },
    skipRateLimit: true,
  });

  return response.messageTemplates || [];
}

// =============================================================================
// WEBHOOK HANDLING
// =============================================================================

/**
 * Verify webhook signature (HMAC-SHA256)
 * Note: WATI may not always provide signature verification.
 * This function provides additional security if a webhook secret is configured.
 *
 * @param payload - Raw request body as string
 * @param signature - Signature from request header (X-Hub-Signature-256 or similar)
 * @returns True if signature is valid or if no secret is configured
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  // If no secret is configured, skip verification (not recommended for production)
  if (!WATI_WEBHOOK_SECRET) {
    console.warn('WATI_WEBHOOK_SECRET not configured. Skipping webhook signature verification.');
    return true;
  }

  if (!signature) {
    console.warn('No signature provided in webhook request');
    return false;
  }

  // Remove 'sha256=' prefix if present
  const providedSignature = signature.replace(/^sha256=/, '');

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', WATI_WEBHOOK_SECRET)
    .update(payload, 'utf8')
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Parse WATI webhook payload into a standardized message format
 *
 * @param payload - Raw webhook payload from WATI
 * @returns Parsed message object
 */
export function parseWatiWebhook(payload: WatiWebhookPayload): ParsedMessage {
  const result: ParsedMessage = {
    from: payload.waId,
    id: payload.id,
    whatsappMessageId: payload.whatsappMessageId,
    timestamp: payload.timestamp,
    type: payload.type,
    senderName: payload.senderName,
    conversationId: payload.conversationId,
    ticketId: payload.ticketId,
    isForwarded: payload.forwarded || payload.frequentlyForwarded || false,
    replyToMessageId: payload.replyContextId || undefined,
  };

  // Parse based on message type
  switch (payload.type) {
    case 'text':
      result.text = { body: payload.text };
      break;

    case 'image':
      console.log('[WATI] Parsing image payload:');
      console.log('[WATI] - data:', payload.data);
      console.log('[WATI] - sourceUrl:', payload.sourceUrl);
      if (payload.data || payload.sourceUrl) {
        // Check if data is already a full URL (WATI sends direct URLs)
        const isDataUrl = payload.data?.startsWith('http');

        if (isDataUrl && payload.data) {
          // data IS the URL - use it directly
          result.image = {
            id: payload.data,
            url: payload.data,
            mimeType: 'image/jpeg',
          };
          console.log('[WATI] - direct URL image:', result.image);
        } else {
          try {
            const imageData = payload.data ? JSON.parse(payload.data) : {};
            // Prefer sourceUrl (direct WhatsApp CDN URL) over constructed URL
            const directUrl = payload.sourceUrl || imageData.url;
            result.image = {
              id: imageData.id || imageData.fileName || payload.data || 'unknown',
              url: directUrl || getMediaUrl(imageData.fileName),
              mimeType: imageData.mimeType || imageData.mime_type || 'image/jpeg',
              caption: imageData.caption,
            };
            console.log('[WATI] - parsed image:', result.image);
          } catch {
            // Handle non-JSON data format - use sourceUrl if available
            result.image = {
              id: payload.data || 'unknown',
              url: payload.sourceUrl || getMediaUrl(payload.data || ''),
              mimeType: 'image/jpeg',
            };
            console.log('[WATI] - fallback image:', result.image);
          }
        }
      }
      break;

    case 'document':
      if (payload.data) {
        try {
          const docData = JSON.parse(payload.data);
          result.document = {
            id: docData.id || docData.fileName,
            url: docData.url || getMediaUrl(docData.fileName),
            mimeType: docData.mimeType || docData.mime_type || 'application/pdf',
            filename: docData.filename || docData.fileName || 'document',
            caption: docData.caption,
          };
        } catch {
          result.document = {
            id: payload.data,
            url: getMediaUrl(payload.data),
            mimeType: 'application/octet-stream',
            filename: 'document',
          };
        }
      }
      break;

    case 'audio':
    case 'voice':
      if (payload.data) {
        // Check if data is already a full URL (WATI sends direct URLs for audio)
        const isDataUrl = payload.data.startsWith('http');

        if (isDataUrl) {
          // data IS the URL - use it directly
          result.audio = {
            id: payload.data,
            url: payload.data,  // Use directly, don't wrap in getMediaUrl
            mimeType: 'audio/ogg',
          };
        } else {
          try {
            const audioData = JSON.parse(payload.data);
            result.audio = {
              id: audioData.id || audioData.fileName,
              url: audioData.url || getMediaUrl(audioData.fileName),
              mimeType: audioData.mimeType || audioData.mime_type || 'audio/ogg',
            };
          } catch {
            result.audio = {
              id: payload.data,
              url: getMediaUrl(payload.data),
              mimeType: 'audio/ogg',
            };
          }
        }
      }
      break;

    case 'video':
      if (payload.data) {
        try {
          const videoData = JSON.parse(payload.data);
          result.video = {
            id: videoData.id || videoData.fileName,
            url: videoData.url || getMediaUrl(videoData.fileName),
            mimeType: videoData.mimeType || videoData.mime_type || 'video/mp4',
            caption: videoData.caption,
          };
        } catch {
          result.video = {
            id: payload.data,
            url: getMediaUrl(payload.data),
            mimeType: 'video/mp4',
          };
        }
      }
      break;

    case 'location':
      if (payload.data) {
        try {
          const locData = JSON.parse(payload.data);
          result.location = {
            latitude: locData.latitude,
            longitude: locData.longitude,
            name: locData.name,
            address: locData.address,
          };
        } catch {
          console.error('Failed to parse location data:', payload.data);
        }
      }
      break;

    case 'sticker':
      if (payload.data) {
        try {
          const stickerData = JSON.parse(payload.data);
          result.sticker = {
            id: stickerData.id || stickerData.fileName,
            url: stickerData.url || getMediaUrl(stickerData.fileName),
          };
        } catch {
          result.sticker = {
            id: payload.data,
            url: getMediaUrl(payload.data),
          };
        }
      }
      break;

    case 'contacts':
      if (payload.data) {
        try {
          const contactsData = JSON.parse(payload.data);
          result.contacts = Array.isArray(contactsData) ? contactsData : [contactsData];
        } catch {
          console.error('Failed to parse contacts data:', payload.data);
        }
      }
      break;

    case 'reaction':
      if (payload.data) {
        try {
          const reactionData = JSON.parse(payload.data);
          result.reaction = {
            messageId: reactionData.message_id || reactionData.messageId,
            emoji: reactionData.emoji,
          };
        } catch {
          console.error('Failed to parse reaction data:', payload.data);
        }
      }
      break;

    case 'interactive':
    case 'button':
      // Handle interactive button or list replies
      if (payload.listReply) {
        result.interactive = {
          type: 'list_reply',
          list_reply: {
            id: payload.listReply.id,
            title: payload.listReply.title,
            description: payload.listReply.description,
          },
        };
      } else if (payload.interactiveButtonReply || payload.buttonReply) {
        const buttonData = payload.interactiveButtonReply || payload.buttonReply;
        result.interactive = {
          type: 'button_reply',
          button_reply: {
            id: buttonData!.id,
            title: buttonData!.title,
          },
        };
      }
      break;
  }

  return result;
}

/**
 * Parse template message status webhook
 *
 * @param payload - Webhook payload for template status update
 */
export function parseTemplateStatusWebhook(payload: any): WatiTemplateStatusWebhook {
  return {
    localMessageId: payload.localMessageId,
    whatsappMessageId: payload.whatsappMessageId,
    waId: payload.waId,
    status: payload.statusString?.toLowerCase() || payload.status,
    timestamp: payload.timestamp,
    failedCode: payload.failedCode,
    failedDetail: payload.failedDetail,
  };
}

/**
 * Determine webhook event type from payload
 */
export function getWebhookEventType(payload: any):
  | 'message_received'
  | 'message_sent'
  | 'message_delivered'
  | 'message_read'
  | 'message_failed'
  | 'template_status'
  | 'unknown' {

  // Check for message received (from customer)
  if (payload.owner === false && payload.eventType === 'message') {
    return 'message_received';
  }

  // Check for template/message status updates
  if (payload.statusString) {
    const status = payload.statusString.toLowerCase();
    if (status === 'sent') return 'message_sent';
    if (status === 'delivered') return 'message_delivered';
    if (status === 'read') return 'message_read';
    if (status === 'failed') return 'message_failed';
  }

  // Check for template-specific events
  if (payload.templateName || payload.localMessageId) {
    return 'template_status';
  }

  return 'unknown';
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a phone number has an active WhatsApp session (within 24 hours)
 * Note: WATI doesn't provide a direct API for this, but you can try sending
 * a session message and check for errors.
 *
 * @param phone - Phone number to check
 */
export async function hasActiveSession(phone: string): Promise<boolean> {
  // This is a best-effort check - WATI doesn't provide a direct endpoint
  // You might need to track sessions in your own database
  console.warn('hasActiveSession is not directly supported by WATI API. Consider tracking sessions in your database.');
  return true; // Default to true, let the API handle session validation
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(): { remaining: number; resetMs: number } {
  return rateLimiter.getStatus();
}

/**
 * Validate phone number format
 *
 * @param phone - Phone number to validate
 * @returns True if valid international format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Basic validation: should be numeric, 10-15 digits
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Format phone number for WATI API
 *
 * @param phone - Phone number in any format
 * @returns Formatted phone number without + prefix
 */
export function formatPhoneNumber(phone: string): string {
  return sanitizePhone(phone);
}

// =============================================================================
// TOKEN MANAGEMENT
// =============================================================================

/**
 * Rotate API token
 * Use this periodically for security or when token is compromised
 */
export async function rotateToken(): Promise<{ newToken: string }> {
  const response = await watiRequest<{ result: boolean; token: string }>({
    method: 'POST',
    endpoint: 'rotateToken',
  });

  return { newToken: response.token };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Message sending
  sendMessage,
  sendTextMessage,
  sendImage,
  sendDocument,
  sendVideo,
  sendAudio,
  sendMedia,
  sendLocation,

  // Interactive messages
  sendInteractiveButtons,
  sendInteractiveList,

  // Template messages
  sendTemplate,
  sendSimpleTemplate,
  sendBulkTemplate,
  sendTemplateWithImage,
  sendTemplateWithDocument,

  // Media handling
  downloadMedia,
  downloadMediaFromUrl,
  getMediaUrl,

  // Contact management
  getContact,
  addContact,
  updateContactAttributes,
  getContacts,

  // Chat management
  assignOperator,
  getMessages,
  getMessageTemplates,

  // Webhook handling
  verifyWebhookSignature,
  parseWatiWebhook,
  parseTemplateStatusWebhook,
  getWebhookEventType,

  // Utilities
  getRateLimitStatus,
  isValidPhoneNumber,
  formatPhoneNumber,
  rotateToken,

  // Error classes
  WatiApiError,
  WatiRateLimitError,
};
