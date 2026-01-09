/**
 * Orange Money Senegal Integration
 *
 * Official Orange Money Web Payment API for Senegal
 * Documentation: https://developer.orange.com/apis/om-webpay
 * Senegal Portal: https://developer.orange-sonatel.com/
 *
 * Payment Flow:
 * 1. Merchant initiates payment via API
 * 2. Customer redirected to Orange Money payment page (or receives USSD prompt)
 * 3. Customer generates OTP via USSD: #144#391*PIN#
 * 4. Customer confirms payment
 * 5. Orange Money sends notification to webhook (notif_url)
 * 6. Merchant verifies transaction status
 */

import { createHmac, randomBytes } from 'crypto';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Orange Money API Configuration
 * Required environment variables:
 * - ORANGE_MONEY_CLIENT_ID: OAuth client ID from Orange Developer Portal
 * - ORANGE_MONEY_CLIENT_SECRET: OAuth client secret
 * - ORANGE_MONEY_MERCHANT_KEY: Merchant key for payment requests
 * - ORANGE_MONEY_WEBHOOK_SECRET: Secret for webhook signature verification
 * - ORANGE_MONEY_ENVIRONMENT: 'sandbox' | 'production'
 */
const config = {
  clientId: process.env.ORANGE_MONEY_CLIENT_ID || '',
  clientSecret: process.env.ORANGE_MONEY_CLIENT_SECRET || '',
  merchantKey: process.env.ORANGE_MONEY_MERCHANT_KEY || '',
  webhookSecret: process.env.ORANGE_MONEY_WEBHOOK_SECRET || '',
  environment: (process.env.ORANGE_MONEY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
};

// API Base URLs
const API_URLS = {
  sandbox: 'https://api.orange.com',
  production: 'https://api.orange.com',
} as const;

// API Endpoints - Using the dev path for sandbox, production for live
const ENDPOINTS = {
  token: '/oauth/v3/token',
  webPayment: {
    sandbox: '/orange-money-webpay/dev/v1/webpayment',
    production: '/orange-money-webpay/sn/v1/webpayment',
  },
  transactionStatus: {
    sandbox: '/orange-money-webpay/dev/v1/transactionstatus',
    production: '/orange-money-webpay/sn/v1/transactionstatus',
  },
} as const;

// Supported currencies by country
const COUNTRY_CURRENCIES: Record<string, string> = {
  SN: 'XOF', // Senegal - CFA Franc
  ML: 'XOF', // Mali
  CI: 'XOF', // Cote d'Ivoire
  CM: 'XAF', // Cameroon
  MG: 'MGA', // Madagascar
  GN: 'GNF', // Guinea
  BW: 'BWP', // Botswana
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Orange Money payment transaction status
 */
export type OrangeMoneyStatus =
  | 'INITIATED' // Payment created, awaiting customer action
  | 'PENDING' // Customer has started payment process
  | 'SUCCESS' // Payment completed successfully
  | 'FAILED' // Payment failed
  | 'EXPIRED' // Payment request expired (typically 15 minutes)
  | 'CANCELLED'; // Payment cancelled by customer

/**
 * OAuth token response from Orange API
 */
export interface OrangeMoneyTokenResponse {
  token_type: 'Bearer';
  access_token: string;
  expires_in: number; // seconds until expiration (typically 3600)
}

/**
 * Request body for initiating a web payment
 */
export interface OrangeMoneyPaymentRequest {
  merchant_key: string;
  currency: string;
  order_id: string;
  amount: number;
  return_url: string;
  cancel_url: string;
  notif_url: string;
  lang?: 'fr' | 'en';
  reference?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response from payment initiation
 */
export interface OrangeMoneyPaymentResponse {
  status: number;
  message: string;
  pay_token: string;
  payment_url: string;
  notif_token: string;
}

/**
 * Request body for checking transaction status
 */
export interface OrangeMoneyStatusRequest {
  order_id: string;
  amount: number;
  pay_token: string;
}

/**
 * Response from transaction status check
 */
export interface OrangeMoneyStatusResponse {
  status: OrangeMoneyStatus;
  order_id: string;
  txnid?: string;
  amount?: number;
  message?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Webhook notification payload from Orange Money
 */
export interface OrangeMoneyWebhookPayload {
  status: OrangeMoneyStatus;
  notif_token: string;
  txnid: string;
  order_id: string;
  amount: number;
  currency: string;
  message?: string;
  timestamp?: string;
}

/**
 * Payment initiation options
 */
export interface InitiatePaymentOptions {
  amount: number;
  orderId?: string;
  reference?: string;
  returnUrl?: string;
  cancelUrl?: string;
  notifyUrl?: string;
  language?: 'fr' | 'en';
  metadata?: Record<string, unknown>;
}

/**
 * Payment initiation result
 */
export interface PaymentInitiationResult {
  success: boolean;
  payToken?: string;
  paymentUrl?: string;
  notifToken?: string;
  orderId?: string;
  error?: OrangeMoneyError;
}

/**
 * Orange Money API error
 */
export interface OrangeMoneyError {
  code: string;
  message: string;
  description?: string;
  httpStatus?: number;
}

// =============================================================================
// TOKEN MANAGEMENT
// =============================================================================

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Get base URL based on environment
 */
function getBaseUrl(): string {
  return API_URLS[config.environment];
}

/**
 * Get the appropriate endpoint based on environment
 */
function getEndpoint(endpoint: keyof typeof ENDPOINTS): string {
  const ep = ENDPOINTS[endpoint];
  if (typeof ep === 'string') {
    return ep;
  }
  return ep[config.environment];
}

/**
 * Generate Basic Auth header for OAuth token request
 */
function getBasicAuthHeader(): string {
  const credentials = `${config.clientId}:${config.clientSecret}`;
  return Buffer.from(credentials).toString('base64');
}

/**
 * Request a new OAuth access token from Orange API
 *
 * Uses OAuth 2.0 Client Credentials grant flow:
 * POST https://api.orange.com/oauth/v3/token
 * Authorization: Basic base64(client_id:client_secret)
 * Content-Type: application/x-www-form-urlencoded
 * grant_type=client_credentials
 */
async function requestAccessToken(): Promise<OrangeMoneyTokenResponse> {
  const url = `${getBaseUrl()}${ENDPOINTS.token}`;

  console.log('[OrangeMoney] Requesting new access token');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${getBasicAuthHeader()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[OrangeMoney] Token request failed:', response.status, errorBody);
    throw createError('AUTH_FAILED', 'Failed to obtain access token', response.status);
  }

  const data = (await response.json()) as OrangeMoneyTokenResponse;
  console.log('[OrangeMoney] Access token obtained, expires in:', data.expires_in, 'seconds');

  return data;
}

/**
 * Get a valid access token, using cache if available
 * Automatically refreshes token 60 seconds before expiration
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  const bufferTime = 60 * 1000; // 60 seconds buffer before expiration

  if (tokenCache && tokenCache.expiresAt > now + bufferTime) {
    return tokenCache.accessToken;
  }

  const tokenResponse = await requestAccessToken();

  tokenCache = {
    accessToken: tokenResponse.access_token,
    expiresAt: now + tokenResponse.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

/**
 * Clear the token cache (useful for testing or when credentials change)
 */
export function clearTokenCache(): void {
  tokenCache = null;
  console.log('[OrangeMoney] Token cache cleared');
}

// =============================================================================
// PAYMENT OPERATIONS
// =============================================================================

/**
 * Generate a unique order ID for the payment
 * Format: OM_XXXXXX_XXXXX (where X is alphanumeric)
 */
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(4).toString('hex').toUpperCase();
  return `OM_${timestamp}_${random}`;
}

/**
 * Initiate an Orange Money web payment
 *
 * This creates a payment request and returns a payment URL where the customer
 * should be redirected to complete the payment.
 *
 * For mobile users in Senegal, customers can also:
 * 1. Dial #144#391*PIN# to generate an OTP
 * 2. Enter the OTP on the payment page
 *
 * @param options Payment options including amount and callbacks
 * @returns Payment initiation result with payment URL and tokens
 */
export async function initiatePayment(
  options: InitiatePaymentOptions
): Promise<PaymentInitiationResult> {
  try {
    // Validate amount
    if (!options.amount || options.amount <= 0) {
      return {
        success: false,
        error: createError('INVALID_AMOUNT', 'Amount must be greater than 0'),
      };
    }

    // Get access token
    const accessToken = await getAccessToken();

    // Generate order ID if not provided
    const orderId = options.orderId || generateOrderId();

    // Build callback URLs
    const baseUrl = process.env.APP_BASE_URL || 'https://gestoo.sn';
    const returnUrl = options.returnUrl || `${baseUrl}/payment/success`;
    const cancelUrl = options.cancelUrl || `${baseUrl}/payment/cancel`;
    const notifyUrl =
      options.notifyUrl ||
      `${process.env.SUPABASE_URL}/functions/v1/payment-webhook?provider=orange_money`;

    // Prepare payment request
    const paymentRequest: OrangeMoneyPaymentRequest = {
      merchant_key: config.merchantKey,
      currency: 'XOF', // CFA Franc for Senegal
      order_id: orderId,
      amount: Math.round(options.amount), // Orange Money requires integer amounts
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notif_url: notifyUrl,
      lang: options.language || 'fr',
      reference: options.reference || 'TPT Payment - Gestoo Platform',
      metadata: options.metadata,
    };

    console.log('[OrangeMoney] Initiating payment:', {
      orderId,
      amount: paymentRequest.amount,
      currency: paymentRequest.currency,
    });

    // Make API request
    const url = `${getBaseUrl()}${getEndpoint('webPayment')}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(paymentRequest),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[OrangeMoney] Payment initiation failed:', response.status, errorBody);

      // Parse error response
      let errorData: { code?: number; message?: string; description?: string } = {};
      try {
        errorData = JSON.parse(errorBody);
      } catch {
        errorData = { message: errorBody };
      }

      return {
        success: false,
        error: createError(
          `PAYMENT_INIT_ERROR_${response.status}`,
          errorData.message || 'Payment initiation failed',
          response.status
        ),
      };
    }

    const data = (await response.json()) as OrangeMoneyPaymentResponse;

    console.log('[OrangeMoney] Payment initiated successfully:', {
      orderId,
      payToken: data.pay_token,
      status: data.status,
    });

    return {
      success: true,
      payToken: data.pay_token,
      paymentUrl: data.payment_url,
      notifToken: data.notif_token,
      orderId,
    };
  } catch (error) {
    console.error('[OrangeMoney] Payment initiation error:', error);
    return {
      success: false,
      error: createError(
        'PAYMENT_INIT_EXCEPTION',
        error instanceof Error ? error.message : 'Unknown error occurred'
      ),
    };
  }
}

/**
 * Check the status of a payment transaction
 *
 * Use this to verify payment status after receiving a webhook notification
 * or to poll for payment completion.
 *
 * @param orderId The order ID used when initiating the payment
 * @param amount The payment amount
 * @param payToken The pay_token received from payment initiation
 * @returns Transaction status response
 */
export async function checkTransactionStatus(
  orderId: string,
  amount: number,
  payToken: string
): Promise<OrangeMoneyStatusResponse> {
  try {
    const accessToken = await getAccessToken();

    const statusRequest: OrangeMoneyStatusRequest = {
      order_id: orderId,
      amount: Math.round(amount),
      pay_token: payToken,
    };

    console.log('[OrangeMoney] Checking transaction status:', { orderId, payToken });

    const url = `${getBaseUrl()}${getEndpoint('transactionStatus')}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(statusRequest),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[OrangeMoney] Status check failed:', response.status, errorBody);

      // Return a failed status on error
      return {
        status: 'FAILED',
        order_id: orderId,
        message: `Status check failed: ${response.status}`,
      };
    }

    const data = (await response.json()) as OrangeMoneyStatusResponse;

    console.log('[OrangeMoney] Transaction status:', {
      orderId,
      status: data.status,
      txnid: data.txnid,
    });

    return data;
  } catch (error) {
    console.error('[OrangeMoney] Status check error:', error);
    return {
      status: 'FAILED',
      order_id: orderId,
      message: error instanceof Error ? error.message : 'Status check failed',
    };
  }
}

/**
 * Poll for payment completion
 *
 * This method polls the transaction status at regular intervals until
 * the payment is completed, failed, or the timeout is reached.
 *
 * @param orderId Order ID
 * @param amount Payment amount
 * @param payToken Pay token
 * @param options Polling options
 * @returns Final transaction status
 */
export async function pollPaymentStatus(
  orderId: string,
  amount: number,
  payToken: string,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
  } = {}
): Promise<OrangeMoneyStatusResponse> {
  const maxAttempts = options.maxAttempts || 20; // Default 20 attempts
  const intervalMs = options.intervalMs || 3000; // Default 3 seconds

  console.log('[OrangeMoney] Starting payment polling:', {
    orderId,
    maxAttempts,
    intervalMs,
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const status = await checkTransactionStatus(orderId, amount, payToken);

    // Terminal states - return immediately
    if (status.status === 'SUCCESS' || status.status === 'FAILED' || status.status === 'EXPIRED') {
      console.log('[OrangeMoney] Payment polling completed:', {
        orderId,
        status: status.status,
        attempts: attempt,
      });
      return status;
    }

    // Still pending - wait and retry
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  // Timeout reached
  console.log('[OrangeMoney] Payment polling timeout:', { orderId });
  return {
    status: 'PENDING',
    order_id: orderId,
    message: 'Payment status polling timeout',
  };
}

// =============================================================================
// WEBHOOK HANDLING
// =============================================================================

/**
 * Verify Orange Money webhook signature
 *
 * Orange Money webhooks include a signature header that should be verified
 * to ensure the webhook is authentic.
 *
 * Note: Orange Money's exact signature format may vary. This implementation
 * supports HMAC-SHA256 signature verification. Adjust based on Orange's
 * actual implementation for your region.
 *
 * @param payload Raw webhook payload (string)
 * @param signature Signature from webhook header
 * @param secret Webhook secret (optional, uses config if not provided)
 * @returns Whether the signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret?: string
): boolean {
  const webhookSecret = secret || config.webhookSecret;

  if (!webhookSecret) {
    console.warn('[OrangeMoney] Webhook secret not configured, skipping signature verification');
    return true; // Allow in development if no secret configured
  }

  if (!signature) {
    console.error('[OrangeMoney] Missing webhook signature');
    return false;
  }

  try {
    // HMAC-SHA256 signature verification
    const hmac = createHmac('sha256', webhookSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Constant-time comparison to prevent timing attacks
    const isValid = safeCompare(signature.toLowerCase(), expectedSignature.toLowerCase());

    if (!isValid) {
      console.error('[OrangeMoney] Invalid webhook signature');
    }

    return isValid;
  } catch (error) {
    console.error('[OrangeMoney] Signature verification error:', error);
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Parse and validate Orange Money webhook payload
 *
 * @param rawPayload Raw webhook body string
 * @param signature Signature from header (x-orange-signature)
 * @returns Parsed webhook payload or null if invalid
 */
export function parseWebhookPayload(
  rawPayload: string,
  signature?: string
): OrangeMoneyWebhookPayload | null {
  // Verify signature if provided
  if (signature && !verifyWebhookSignature(rawPayload, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(rawPayload) as OrangeMoneyWebhookPayload;

    // Validate required fields
    if (!payload.status || !payload.txnid) {
      console.error('[OrangeMoney] Invalid webhook payload: missing required fields');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[OrangeMoney] Failed to parse webhook payload:', error);
    return null;
  }
}

/**
 * Verify webhook notification token
 *
 * When initiating a payment, Orange Money returns a notif_token.
 * The webhook notification includes this token, which can be used
 * to verify the notification belongs to your payment.
 *
 * @param receivedToken Token from webhook payload
 * @param expectedToken Token from payment initiation
 * @returns Whether the tokens match
 */
export function verifyNotifToken(receivedToken: string, expectedToken: string): boolean {
  return safeCompare(receivedToken, expectedToken);
}

// =============================================================================
// TPT PAYMENT INTEGRATION
// =============================================================================

/**
 * Initiate TPT (Taxe de Promotion Touristique) payment via Orange Money
 *
 * This is the main integration point for the Teranga platform.
 * It handles the complete payment flow for tourist tax payments.
 *
 * @param landlordId Landlord ID
 * @param amount Payment amount in FCFA
 * @param liabilityIds Tax liability IDs being paid
 * @returns Payment initiation result
 */
export async function initiateTPTPayment(
  landlordId: string,
  amount: number,
  liabilityIds: string[]
): Promise<PaymentInitiationResult & { orderId: string }> {
  const orderId = generateOrderId();

  const result = await initiatePayment({
    amount,
    orderId,
    reference: `TPT-${landlordId.substring(0, 8)}`,
    language: 'fr',
    metadata: {
      landlord_id: landlordId,
      liability_ids: liabilityIds,
      payment_type: 'tpt',
      initiated_at: new Date().toISOString(),
    },
  });

  return {
    ...result,
    orderId,
  };
}

/**
 * Generate USSD instructions for Orange Money payment
 *
 * In Senegal, customers can pay via USSD by:
 * 1. Dialing #144#391*PIN# to generate an OTP
 * 2. Entering the OTP on the payment page
 *
 * @param amount Payment amount
 * @returns Localized USSD instructions
 */
export function getUSSDInstructions(amount: number, language: 'fr' | 'wo' | 'en' = 'fr'): string {
  const formattedAmount = amount.toLocaleString('fr-FR');

  const instructions = {
    fr: `Pour payer ${formattedAmount} FCFA avec Orange Money:

1. Composez #144#391*CODE_SECRET# sur votre telephone
2. Vous recevrez un code OTP par SMS
3. Entrez ce code sur la page de paiement
4. Confirmez le paiement

Ou ouvrez l'application Orange Money pour valider.`,

    wo: `Ngir fey ${formattedAmount} FCFA ak Orange Money:

1. Telefonam, dugal #144#391*CODE_SECRET#
2. Dinaa am OTP ci SMS
3. Dugal OTP bi ci page de paiement bi
4. Confirmeer fey bi

Walla ubbi application Orange Money ngir valider.`,

    en: `To pay ${formattedAmount} FCFA with Orange Money:

1. Dial #144#391*SECRET_CODE# on your phone
2. You will receive an OTP code by SMS
3. Enter this code on the payment page
4. Confirm the payment

Or open the Orange Money app to validate.`,
  };

  return instructions[language] || instructions.fr;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Orange Money error codes and their meanings
 */
export const ERROR_CODES: Record<string, string> = {
  AUTH_FAILED: 'Authentication failed. Check your API credentials.',
  INVALID_AMOUNT: 'Invalid payment amount.',
  INVALID_MERCHANT_KEY: 'Invalid merchant key.',
  PAYMENT_INIT_ERROR_400: 'Invalid payment request. Check parameters.',
  PAYMENT_INIT_ERROR_401: 'Unauthorized. Check API credentials.',
  PAYMENT_INIT_ERROR_403: 'Forbidden. Merchant not authorized for this operation.',
  PAYMENT_INIT_ERROR_404: 'API endpoint not found.',
  PAYMENT_INIT_ERROR_500: 'Orange Money server error. Please retry.',
  PAYMENT_INIT_EXCEPTION: 'Unexpected error during payment initiation.',
  INSUFFICIENT_FUNDS: 'Customer has insufficient funds.',
  TRANSACTION_NOT_FOUND: 'Transaction not found.',
  TRANSACTION_EXPIRED: 'Payment request has expired.',
  NETWORK_ERROR: 'Network error. Please check connectivity.',
};

/**
 * Create a standardized Orange Money error
 */
function createError(code: string, message: string, httpStatus?: number): OrangeMoneyError {
  return {
    code,
    message,
    description: ERROR_CODES[code] || message,
    httpStatus,
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: OrangeMoneyError): boolean {
  const retryableCodes = ['PAYMENT_INIT_ERROR_500', 'NETWORK_ERROR', 'AUTH_FAILED'];
  return retryableCodes.includes(error.code);
}

/**
 * Get user-friendly error message in French
 */
export function getErrorMessage(error: OrangeMoneyError, language: 'fr' | 'en' = 'fr'): string {
  const messages: Record<string, Record<string, string>> = {
    AUTH_FAILED: {
      fr: "Erreur d'authentification. Veuillez contacter le support.",
      en: 'Authentication error. Please contact support.',
    },
    INVALID_AMOUNT: {
      fr: 'Montant invalide.',
      en: 'Invalid amount.',
    },
    INSUFFICIENT_FUNDS: {
      fr: 'Solde Orange Money insuffisant.',
      en: 'Insufficient Orange Money balance.',
    },
    TRANSACTION_EXPIRED: {
      fr: 'La demande de paiement a expire. Veuillez reessayer.',
      en: 'Payment request has expired. Please try again.',
    },
    NETWORK_ERROR: {
      fr: 'Erreur de connexion. Veuillez verifier votre connexion internet.',
      en: 'Connection error. Please check your internet connection.',
    },
    default: {
      fr: "Une erreur s'est produite. Veuillez reessayer.",
      en: 'An error occurred. Please try again.',
    },
  };

  const messageSet = messages[error.code] || messages.default;
  return messageSet[language] || messageSet.fr;
}

// =============================================================================
// SANDBOX / TESTING
// =============================================================================

/**
 * Sandbox test configuration
 *
 * To test Orange Money integration:
 * 1. Register at https://developer.orange.com
 * 2. Create an application to get client_id and client_secret
 * 3. Subscribe to the Orange Money Web Payment API
 * 4. Use the sandbox environment for testing
 *
 * Note: Orange Money sandbox may have limitations. Some features
 * may require contacting Orange directly for test credentials.
 */
export const SANDBOX_CONFIG = {
  baseUrl: 'https://api.orange.com',
  webPaymentEndpoint: '/orange-money-webpay/dev/v1/webpayment',
  statusEndpoint: '/orange-money-webpay/dev/v1/transactionstatus',

  // Test phone numbers (may vary by region)
  testPhoneNumbers: ['+221771234567', '+221781234567'],

  // Test amounts
  testAmounts: {
    success: 1000, // Amount that triggers success in sandbox
    failure: 9999, // Amount that triggers failure in sandbox
    pending: 5000, // Amount that remains pending
  },
};

/**
 * Check if running in sandbox mode
 */
export function isSandboxMode(): boolean {
  return config.environment === 'sandbox';
}

/**
 * Validate configuration
 * Call this at startup to ensure all required config is present
 */
export function validateConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.clientId) {
    errors.push('ORANGE_MONEY_CLIENT_ID is not configured');
  }
  if (!config.clientSecret) {
    errors.push('ORANGE_MONEY_CLIENT_SECRET is not configured');
  }
  if (!config.merchantKey) {
    errors.push('ORANGE_MONEY_MERCHANT_KEY is not configured');
  }

  if (config.environment === 'production' && !config.webhookSecret) {
    errors.push('ORANGE_MONEY_WEBHOOK_SECRET is required in production');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Configuration
  validateConfiguration,
  isSandboxMode,
  clearTokenCache,

  // Payment operations
  initiatePayment,
  initiateTPTPayment,
  checkTransactionStatus,
  pollPaymentStatus,
  generateOrderId,

  // Webhook handling
  verifyWebhookSignature,
  parseWebhookPayload,
  verifyNotifToken,

  // Utilities
  getUSSDInstructions,
  getErrorMessage,
  isRetryableError,

  // Constants
  ERROR_CODES,
  SANDBOX_CONFIG,
};
