/**
 * Wave Mobile Money API Integration for Senegal
 *
 * Documentation: https://docs.wave.com/business
 * Checkout API: https://docs.wave.com/checkout
 * Payout API: https://docs.wave.com/payout
 * Webhooks: https://docs.wave.com/webhook
 *
 * Wave is the most popular mobile payment method in Senegal.
 * This module provides complete integration for:
 * - Checkout sessions (receive payments)
 * - Payouts (send money)
 * - Balance checking
 * - Webhook handling
 * - Refund processing
 */

import { createHmac } from 'crypto';

// ============================================
// CONFIGURATION
// ============================================

const WAVE_API_BASE_URL = 'https://api.wave.com';
const WAVE_API_KEY = process.env.WAVE_API_KEY || 'wave_sn_prod_vdLJ3BGK5ivwTpkEO4UBXHD7X8_jMG336fuMYuWFfIf-HeRPu_YCB7O4EQm_e372Gug89KUYyasAcAl3r86HYZvc5-y-Qzl-ig';
const WAVE_WEBHOOK_SECRET = process.env.WAVE_WEBHOOK_SECRET || '';

// Sandbox/Test environment (Wave doesn't have a public sandbox)
// Use small amounts for testing in production
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ============================================
// TYPES
// ============================================

export type WaveCurrency = 'XOF' | 'CDF' | 'GNF' | 'KES' | 'RWF' | 'UGX';

export type WaveCheckoutStatus = 'open' | 'complete' | 'expired';

export type WavePaymentStatus = 'processing' | 'cancelled' | 'succeeded';

export type WavePayoutStatus = 'processing' | 'succeeded' | 'failed';

export type WaveWebhookEventType =
  | 'checkout.session.completed'
  | 'checkout.session.payment_failed'
  | 'b2b.payment_received'
  | 'b2b.payment_failed'
  | 'merchant.payment_received';

export type WaveWebhookSecurityStrategy = 'shared_secret' | 'signing_secret' | 'ip_whitelist';

export interface WaveCheckoutSession {
  id: string;
  checkout_status: WaveCheckoutStatus;
  client_reference: string | null;
  currency: WaveCurrency;
  error_url: string;
  last_payment_error: WavePaymentError | null;
  business_name: string;
  payment_status: WavePaymentStatus | null;
  transaction_id: string | null;
  amount: string;
  wave_launch_url: string;
  when_completed: string | null;
  when_created: string;
  when_expires: string;
  success_url: string;
  aggregated_merchant_id: string | null;
}

export interface WavePaymentError {
  error_code: string;
  error_message: string;
}

export interface WaveCreateCheckoutRequest {
  /** Payment amount as string (e.g., "1000" or "100.50") */
  amount: string;
  /** ISO 4217 currency code (XOF for Senegal) */
  currency: WaveCurrency;
  /** HTTPS URL to redirect on success */
  success_url: string;
  /** HTTPS URL to redirect on error */
  error_url: string;
  /** Optional client reference for tracking (max 255 chars) */
  client_reference?: string;
  /** Optional: restrict payment to specific phone number (E.164 format) */
  restrict_payer_mobile?: string;
  /** Optional: aggregated merchant ID for marketplace payments */
  aggregated_merchant_id?: string;
}

export interface WaveBalance {
  amount: string;
  currency: WaveCurrency;
}

export interface WaveTransaction {
  timestamp: string;
  transaction_id: string;
  amount: string;
  fee: string;
  currency: WaveCurrency;
  counterparty_name: string | null;
  counterparty_mobile: string | null;
  is_reversal: boolean;
}

export interface WaveTransactionsResponse {
  items: WaveTransaction[];
  page_state: string | null;
}

export interface WaveCreatePayoutRequest {
  /** ISO 4217 currency code */
  currency: WaveCurrency;
  /** Recipient phone number in E.164 format (e.g., "+221771234567") */
  mobile: string;
  /** Amount to receive (no decimals for XOF) */
  receive_amount: string;
  /** Optional: recipient name for reference */
  name?: string;
  /** Optional: national ID for compliance */
  national_id?: string;
  /** Optional: client reference for tracking */
  client_reference?: string;
  /** Optional: reason for payment */
  payment_reason?: string;
}

export interface WavePayout {
  id: string;
  status: WavePayoutStatus;
  currency: WaveCurrency;
  mobile: string;
  receive_amount: string;
  fee: string;
  client_reference: string | null;
  name: string | null;
  timestamp: string;
  payout_error: WavePaymentError | null;
}

export interface WavePayoutBatch {
  id: string;
  status: 'processing' | 'completed';
  payouts: WavePayout[];
}

export interface WaveRefundRequest {
  /** Amount to refund (must be <= original amount) */
  amount?: string;
}

export interface WaveWebhookEvent {
  id: string;
  type: WaveWebhookEventType;
  data: WaveCheckoutSession | Record<string, unknown>;
}

export interface WaveApiError {
  code: string;
  message: string;
  field?: string;
}

export interface WaveErrorResponse {
  errors: WaveApiError[];
}

// ============================================
// API CLIENT
// ============================================

class WaveApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = WAVE_API_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    options: {
      body?: object;
      idempotencyKey?: string;
      queryParams?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (options.queryParams) {
      Object.entries(options.queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    // Idempotency key required for all POST requests that modify data
    if (method === 'POST' && options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorResponse = data as WaveErrorResponse;
      const error = new Error(
        `Wave API Error: ${errorResponse.errors?.[0]?.message || response.statusText}`
      );
      (error as any).code = errorResponse.errors?.[0]?.code;
      (error as any).status = response.status;
      (error as any).errors = errorResponse.errors;
      throw error;
    }

    return data as T;
  }

  // ============================================
  // CHECKOUT API
  // ============================================

  /**
   * Create a checkout session to receive a payment
   *
   * @param request - Checkout session parameters
   * @param idempotencyKey - Unique key to prevent duplicate transactions
   * @returns Checkout session with wave_launch_url
   *
   * @example
   * const session = await wave.createCheckoutSession({
   *   amount: '5000',
   *   currency: 'XOF',
   *   success_url: 'https://example.com/success',
   *   error_url: 'https://example.com/error',
   *   client_reference: 'order_123'
   * }, 'unique-key-123');
   *
   * // Redirect user to session.wave_launch_url
   */
  async createCheckoutSession(
    request: WaveCreateCheckoutRequest,
    idempotencyKey: string
  ): Promise<WaveCheckoutSession> {
    return this.request<WaveCheckoutSession>('POST', '/v1/checkout/sessions', {
      body: request,
      idempotencyKey,
    });
  }

  /**
   * Retrieve a checkout session by ID
   *
   * @param checkoutId - The checkout session ID
   * @returns Checkout session details
   */
  async getCheckoutSession(checkoutId: string): Promise<WaveCheckoutSession> {
    return this.request<WaveCheckoutSession>('GET', `/v1/checkout/sessions/${checkoutId}`);
  }

  /**
   * Retrieve a checkout session by transaction ID
   *
   * @param transactionId - The Wave transaction ID
   * @returns Checkout session details
   */
  async getCheckoutSessionByTransaction(transactionId: string): Promise<WaveCheckoutSession> {
    return this.request<WaveCheckoutSession>('GET', '/v1/checkout/sessions', {
      queryParams: { transaction_id: transactionId },
    });
  }

  /**
   * Search checkout sessions by client reference
   *
   * @param clientReference - Your reference for the transaction
   * @returns List of matching checkout sessions
   */
  async searchCheckoutSessions(clientReference: string): Promise<{ items: WaveCheckoutSession[] }> {
    return this.request<{ items: WaveCheckoutSession[] }>('GET', '/v1/checkout/sessions/search', {
      queryParams: { client_reference: clientReference },
    });
  }

  /**
   * Refund a completed checkout session
   *
   * @param checkoutId - The checkout session ID to refund
   * @param request - Optional partial refund amount
   * @param idempotencyKey - Unique key to prevent duplicate refunds
   * @returns Updated checkout session
   */
  async refundCheckoutSession(
    checkoutId: string,
    request: WaveRefundRequest = {},
    idempotencyKey: string
  ): Promise<WaveCheckoutSession> {
    return this.request<WaveCheckoutSession>('POST', `/v1/checkout/sessions/${checkoutId}/refund`, {
      body: request,
      idempotencyKey,
    });
  }

  /**
   * Manually expire an open checkout session
   *
   * @param checkoutId - The checkout session ID to expire
   * @param idempotencyKey - Unique key for idempotency
   * @returns Updated checkout session
   */
  async expireCheckoutSession(
    checkoutId: string,
    idempotencyKey: string
  ): Promise<WaveCheckoutSession> {
    return this.request<WaveCheckoutSession>('POST', `/v1/checkout/sessions/${checkoutId}/expire`, {
      idempotencyKey,
    });
  }

  // ============================================
  // PAYOUT API
  // ============================================

  /**
   * Send money to a recipient (synchronous)
   *
   * @param request - Payout parameters
   * @param idempotencyKey - Unique key to prevent duplicate payouts
   * @returns Payout result
   *
   * @example
   * const payout = await wave.createPayout({
   *   currency: 'XOF',
   *   mobile: '+221771234567',
   *   receive_amount: '10000',
   *   name: 'John Doe',
   *   client_reference: 'refund_123',
   *   payment_reason: 'TPT refund'
   * }, 'unique-payout-key');
   */
  async createPayout(request: WaveCreatePayoutRequest, idempotencyKey: string): Promise<WavePayout> {
    return this.request<WavePayout>('POST', '/v1/payout', {
      body: request,
      idempotencyKey,
    });
  }

  /**
   * Get a payout by ID
   *
   * @param payoutId - The payout ID
   * @returns Payout details
   */
  async getPayout(payoutId: string): Promise<WavePayout> {
    return this.request<WavePayout>('GET', `/v1/payout/${payoutId}`);
  }

  /**
   * Search payouts by client reference
   *
   * @param clientReference - Your reference for the payout
   * @returns List of matching payouts
   */
  async searchPayouts(clientReference: string): Promise<{ items: WavePayout[] }> {
    return this.request<{ items: WavePayout[] }>('GET', '/v1/payouts/search', {
      queryParams: { client_reference: clientReference },
    });
  }

  /**
   * Create a batch of payouts (asynchronous)
   *
   * @param payouts - Array of payout requests
   * @param idempotencyKey - Unique key for the batch
   * @returns Batch ID for polling
   */
  async createPayoutBatch(
    payouts: WaveCreatePayoutRequest[],
    idempotencyKey: string
  ): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', '/v1/payout-batch', {
      body: { payouts },
      idempotencyKey,
    });
  }

  /**
   * Get a payout batch status
   *
   * @param batchId - The batch ID
   * @returns Batch status and payouts
   */
  async getPayoutBatch(batchId: string): Promise<WavePayoutBatch> {
    return this.request<WavePayoutBatch>('GET', `/v1/payout-batch/${batchId}`);
  }

  /**
   * Reverse a completed payout (within 3 days)
   *
   * @param payoutId - The payout ID to reverse
   * @param idempotencyKey - Unique key for the reversal
   * @returns Reversed payout details
   *
   * Note: Payouts can only be reversed within 3 days of execution
   */
  async reversePayout(payoutId: string, idempotencyKey: string): Promise<WavePayout> {
    return this.request<WavePayout>('POST', `/v1/payout/${payoutId}/reverse`, {
      idempotencyKey,
    });
  }

  // ============================================
  // BALANCE & RECONCILIATION API
  // ============================================

  /**
   * Get current wallet balance
   *
   * @returns Current balance
   */
  async getBalance(): Promise<WaveBalance> {
    return this.request<WaveBalance>('GET', '/v1/balance');
  }

  /**
   * Get transactions for reconciliation
   *
   * @param date - Date in YYYY-MM-DD format (defaults to today)
   * @param after - Pagination cursor
   * @param includeSubaccounts - Include subaccount transactions
   * @returns List of transactions
   */
  async getTransactions(
    date?: string,
    after?: string,
    includeSubaccounts?: boolean
  ): Promise<WaveTransactionsResponse> {
    const queryParams: Record<string, string> = {};

    if (date) queryParams.date = date;
    if (after) queryParams.after = after;
    if (includeSubaccounts) queryParams.include_subaccounts = 'true';

    return this.request<WaveTransactionsResponse>('GET', '/v1/transactions', { queryParams });
  }

  /**
   * Refund a transaction by ID (using Balance API)
   *
   * @param transactionId - The transaction ID to refund
   * @param idempotencyKey - Unique key for the refund
   * @returns Refund result
   */
  async refundTransaction(transactionId: string, idempotencyKey: string): Promise<WaveTransaction> {
    return this.request<WaveTransaction>('POST', `/v1/transactions/${transactionId}/refund`, {
      idempotencyKey,
    });
  }
}

// ============================================
// WEBHOOK HANDLING
// ============================================

/**
 * Verify Wave webhook signature using HMAC-SHA256
 *
 * Wave uses the signing secret strategy where:
 * - Wave-Signature header contains: t=<timestamp>,v1=<signature>
 * - Signature is HMAC-SHA256 of: <timestamp>.<raw_body>
 *
 * @param rawBody - The raw request body (unparsed)
 * @param signatureHeader - The Wave-Signature header value
 * @param secret - Your webhook signing secret
 * @param toleranceSeconds - Max age of webhook (default 5 minutes)
 * @returns True if signature is valid
 */
export function verifyWaveWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = 300
): boolean {
  try {
    // Parse signature header: t=<timestamp>,v1=<sig1>,v1=<sig2>
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const signatures = parts.filter((p) => p.startsWith('v1=')).map((p) => p.substring(3));

    if (!timestampPart || signatures.length === 0) {
      console.error('Invalid Wave signature header format');
      return false;
    }

    const timestamp = timestampPart.substring(2);
    const timestampNum = parseInt(timestamp, 10);

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > toleranceSeconds) {
      console.error('Wave webhook timestamp outside tolerance');
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = createHmac('sha256', secret).update(signedPayload).digest('hex');

    // Compare against all provided signatures
    return signatures.some((sig) => sig === expectedSignature);
  } catch (error) {
    console.error('Error verifying Wave webhook signature:', error);
    return false;
  }
}

/**
 * Verify Wave webhook using shared secret strategy
 *
 * @param authorizationHeader - The Authorization header value
 * @param secret - Your webhook shared secret
 * @returns True if secret matches
 */
export function verifyWaveWebhookSharedSecret(
  authorizationHeader: string,
  secret: string
): boolean {
  // Format: Bearer <secret>
  const providedSecret = authorizationHeader.replace('Bearer ', '');
  return providedSecret === secret;
}

/**
 * Parse and validate a Wave webhook event
 *
 * @param rawBody - The raw request body
 * @param signatureHeader - The Wave-Signature header (optional for shared secret)
 * @param authHeader - The Authorization header (optional for signing secret)
 * @param secret - Your webhook secret
 * @param strategy - Security strategy being used
 * @returns Parsed webhook event or null if invalid
 */
export function parseWaveWebhook(
  rawBody: string,
  signatureHeader: string | null,
  authHeader: string | null,
  secret: string,
  strategy: WaveWebhookSecurityStrategy = 'signing_secret'
): WaveWebhookEvent | null {
  // Verify signature based on strategy
  if (strategy === 'signing_secret' && signatureHeader) {
    if (!verifyWaveWebhookSignature(rawBody, signatureHeader, secret)) {
      return null;
    }
  } else if (strategy === 'shared_secret' && authHeader) {
    if (!verifyWaveWebhookSharedSecret(authHeader, secret)) {
      return null;
    }
  }

  try {
    return JSON.parse(rawBody) as WaveWebhookEvent;
  } catch (error) {
    console.error('Error parsing Wave webhook body:', error);
    return null;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format amount for Wave API (string with proper decimal places)
 *
 * @param amount - Amount as number
 * @param currency - Currency code (XOF has no decimals)
 * @returns Formatted amount string
 */
export function formatWaveAmount(amount: number, currency: WaveCurrency = 'XOF'): string {
  // XOF, GNF, UGX have no decimals
  const noDecimalCurrencies: WaveCurrency[] = ['XOF', 'GNF', 'UGX'];

  if (noDecimalCurrencies.includes(currency)) {
    return Math.round(amount).toString();
  }

  return amount.toFixed(2);
}

/**
 * Parse Wave amount string to number
 *
 * @param amount - Amount as string from Wave API
 * @returns Amount as number
 */
export function parseWaveAmount(amount: string): number {
  return parseFloat(amount);
}

/**
 * Format phone number to E.164 format for Wave
 *
 * @param phone - Phone number in various formats
 * @param defaultCountryCode - Default country code (221 for Senegal)
 * @returns E.164 formatted phone number
 */
export function formatWavePhone(phone: string, defaultCountryCode: string = '221'): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If starts with +, it's already E.164
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.substring(2);
  }

  // If starts with country code without +, add +
  if (cleaned.startsWith(defaultCountryCode)) {
    return '+' + cleaned;
  }

  // Otherwise, assume local number and add country code
  return '+' + defaultCountryCode + cleaned;
}

/**
 * Generate a unique idempotency key
 *
 * @param prefix - Optional prefix for the key
 * @returns Unique idempotency key
 */
export function generateIdempotencyKey(prefix: string = 'wave'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Check if a checkout session can be refunded
 *
 * @param session - The checkout session
 * @returns True if refundable
 */
export function isCheckoutRefundable(session: WaveCheckoutSession): boolean {
  return session.checkout_status === 'complete' && session.payment_status === 'succeeded';
}

/**
 * Check if a payout can be reversed (within 3 days)
 *
 * @param payout - The payout
 * @returns True if reversible
 */
export function isPayoutReversible(payout: WavePayout): boolean {
  if (payout.status !== 'succeeded') {
    return false;
  }

  const payoutDate = new Date(payout.timestamp);
  const now = new Date();
  const daysSincePayoutMs = now.getTime() - payoutDate.getTime();
  const daysSincePayout = daysSincePayoutMs / (1000 * 60 * 60 * 24);

  return daysSincePayout <= 3;
}

/**
 * Map Wave payment errors to user-friendly messages (French)
 */
export const WAVE_ERROR_MESSAGES: Record<string, string> = {
  'blocked-account': 'Votre compte Wave est bloque. Veuillez contacter Wave.',
  'insufficient-funds': 'Solde insuffisant sur votre compte Wave.',
  'cross-border-payment-not-allowed': 'Les paiements transfrontaliers ne sont pas autorises.',
  'payer-mobile-mismatch': 'Le numero de telephone ne correspond pas.',
  'kyb-limits-exceeded': "Les limites du compte professionnel sont atteintes.",
  'checkout-session-not-found': 'Session de paiement introuvable.',
  'checkout-refund-failed': 'Le remboursement a echoue. Veuillez reessayer.',
  'request-validation-error': 'Donnees de requete invalides.',
  'invalid-auth': "Erreur d'authentification.",
  'api-key-revoked': "La cle API a ete revoquee.",
  'rate-limit-exceeded': 'Trop de requetes. Veuillez patienter.',
};

/**
 * Get user-friendly error message for Wave error code
 *
 * @param errorCode - Wave error code
 * @returns User-friendly message in French
 */
export function getWaveErrorMessage(errorCode: string): string {
  return WAVE_ERROR_MESSAGES[errorCode] || 'Une erreur est survenue. Veuillez reessayer.';
}

// ============================================
// WAVE IP ADDRESSES FOR WHITELISTING
// ============================================

/**
 * Wave webhook IP addresses for IP whitelisting security strategy
 * These IPs should be whitelisted if using IP-based verification
 */
export const WAVE_WEBHOOK_IPS = [
  '104.155.43.220',
  '35.195.222.62',
  '35.205.237.58',
  '34.76.250.180',
  '35.233.107.100',
  '35.205.125.185',
  '35.195.207.233',
  '35.195.42.241',
  '35.195.254.216',
  '34.77.203.97',
  '35.195.115.224',
  '35.205.132.32',
  '35.205.100.88',
  '35.241.219.1',
  '34.77.197.247',
];

/**
 * Check if an IP address is from Wave
 *
 * @param ip - IP address to check
 * @returns True if IP is from Wave
 */
export function isWaveIp(ip: string): boolean {
  return WAVE_WEBHOOK_IPS.includes(ip);
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let waveClient: WaveApiClient | null = null;

/**
 * Get the Wave API client singleton
 *
 * @returns WaveApiClient instance
 */
export function getWaveClient(): WaveApiClient {
  if (!waveClient) {
    if (!WAVE_API_KEY) {
      throw new Error('WAVE_API_KEY environment variable is not set');
    }
    waveClient = new WaveApiClient(WAVE_API_KEY);
  }
  return waveClient;
}

/**
 * Create a new Wave API client with custom configuration
 *
 * @param apiKey - Wave API key
 * @param baseUrl - Optional custom base URL
 * @returns New WaveApiClient instance
 */
export function createWaveClient(apiKey: string, baseUrl?: string): WaveApiClient {
  return new WaveApiClient(apiKey, baseUrl);
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export {
  WaveApiClient,
  WAVE_API_BASE_URL,
  IS_PRODUCTION,
};

// Default export
export default getWaveClient;
