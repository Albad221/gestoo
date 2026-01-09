/**
 * Payment Types and Utilities for Gestoo
 *
 * This module provides shared payment types and utilities for:
 * - Wave Mobile Money (primary in Senegal)
 * - Orange Money
 * - Payment status tracking
 * - Webhook handling
 * - Receipt generation
 */

// ============================================
// PAYMENT TYPES
// ============================================

export type PaymentProvider = 'wave' | 'orange_money' | 'card' | 'bank_transfer';

export type PaymentStatus =
  | 'pending'      // Payment initiated, awaiting user action
  | 'processing'   // Payment in progress
  | 'completed'    // Payment successful
  | 'failed'       // Payment failed
  | 'cancelled'    // Payment cancelled by user
  | 'refunded'     // Payment refunded
  | 'expired';     // Payment session expired

export type RefundStatus =
  | 'pending'      // Refund initiated
  | 'processing'   // Refund in progress
  | 'completed'    // Refund successful
  | 'failed';      // Refund failed

export type WebhookEventType =
  | 'payment.initiated'
  | 'payment.completed'
  | 'payment.failed'
  | 'payment.cancelled'
  | 'payment.refunded'
  | 'refund.initiated'
  | 'refund.completed'
  | 'refund.failed';

// ============================================
// PAYMENT REQUEST TYPES
// ============================================

export interface InitiatePaymentRequest {
  /** Amount in local currency (FCFA/XOF for Senegal) */
  amount: number;
  /** Payment provider */
  provider: PaymentProvider;
  /** Landlord ID making the payment */
  landlord_id: string;
  /** Optional tax liability ID being paid */
  tax_liability_id?: string;
  /** Optional tax liability IDs for batch payment */
  tax_liability_ids?: string[];
  /** Payer phone number in E.164 format */
  payer_phone: string;
  /** URL to redirect on success */
  success_url?: string;
  /** URL to redirect on error/cancellation */
  error_url?: string;
  /** Optional client reference for tracking */
  client_reference?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface InitiatePaymentResponse {
  /** Internal payment ID */
  payment_id: string;
  /** Payment provider reference */
  provider_reference: string;
  /** URL to redirect user for payment (Wave launch URL) */
  payment_url: string;
  /** Session expiration timestamp */
  expires_at: string;
  /** Payment status */
  status: PaymentStatus;
}

export interface RefundRequest {
  /** Payment ID to refund */
  payment_id: string;
  /** Amount to refund (partial refund if less than original) */
  amount?: number;
  /** Reason for refund */
  reason?: string;
  /** Idempotency key to prevent duplicate refunds */
  idempotency_key: string;
}

export interface RefundResponse {
  /** Refund ID */
  refund_id: string;
  /** Original payment ID */
  payment_id: string;
  /** Refunded amount */
  amount: number;
  /** Refund status */
  status: RefundStatus;
  /** Provider reference for refund */
  provider_reference: string;
  /** Timestamp of refund */
  refunded_at: string | null;
}

// ============================================
// PAYMENT RECORD TYPES
// ============================================

export interface PaymentRecord {
  id: string;
  landlord_id: string;
  tax_liability_id: string | null;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  provider_reference: string | null;
  provider_transaction_id: string | null;
  status: PaymentStatus;
  receipt_number: string | null;
  receipt_url: string | null;
  treasury_settled: boolean;
  treasury_settled_at: string | null;
  treasury_reference: string | null;
  metadata: PaymentMetadata | null;
  initiated_at: string;
  completed_at: string | null;
  created_at: string;
  error_code: string | null;
  error_message: string | null;
}

export interface PaymentMetadata {
  /** Wave checkout session ID */
  wave_checkout_id?: string;
  /** Wave transaction ID */
  wave_transaction_id?: string;
  /** Orange Money order ID */
  orange_order_id?: string;
  /** Orange Money transaction ID */
  orange_txn_id?: string;
  /** Payer phone number */
  payer_phone?: string;
  /** Payer name */
  payer_name?: string;
  /** Client reference */
  client_reference?: string;
  /** Array of tax liability IDs for batch payments */
  liability_ids?: string[];
  /** Failure reason if any */
  failure_reason?: string;
  /** Number of retry attempts */
  retry_count?: number;
  /** Webhook event IDs received */
  webhook_events?: string[];
  /** Custom metadata */
  [key: string]: unknown;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export interface PaymentWebhookEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: WebhookEventType;
  /** Payment provider */
  provider: PaymentProvider;
  /** Event timestamp */
  timestamp: string;
  /** Event data */
  data: PaymentWebhookData;
}

export interface PaymentWebhookData {
  /** Provider's reference ID */
  provider_reference: string;
  /** Provider's transaction ID */
  transaction_id: string | null;
  /** Payment amount */
  amount: number;
  /** Currency */
  currency: string;
  /** Payment status */
  status: string;
  /** Error code if failed */
  error_code: string | null;
  /** Error message if failed */
  error_message: string | null;
  /** Payer phone number */
  payer_phone: string | null;
  /** Payer name */
  payer_name: string | null;
  /** Client reference */
  client_reference: string | null;
  /** Raw provider data */
  raw: Record<string, unknown>;
}

export interface WebhookProcessingResult {
  success: boolean;
  payment_id: string | null;
  status_updated: boolean;
  error: string | null;
}

// ============================================
// RECEIPT TYPES
// ============================================

export interface ReceiptData {
  /** Receipt number */
  receipt_number: string;
  /** Payment details */
  payment: {
    id: string;
    amount: number;
    currency: string;
    provider: PaymentProvider;
    transaction_id: string | null;
    completed_at: string;
  };
  /** Payer information */
  payer: {
    name: string;
    phone: string;
    landlord_id: string;
    business_name: string | null;
    ninea: string | null;
    address: string | null;
  };
  /** Tax details */
  tax: {
    type: 'TPT'; // Taxe de Promotion Touristique
    period_start: string | null;
    period_end: string | null;
    guest_nights: number;
    rate_per_night: number;
    subtotal: number;
    total: number;
  };
  /** Property details */
  property: {
    id: string;
    name: string;
    license_number: string | null;
    address: string;
    city: string;
    region: string;
  };
  /** Treasury reference */
  treasury: {
    reference: string | null;
    settled_at: string | null;
  };
  /** Receipt metadata */
  issued_at: string;
  valid_until: string | null;
  verification_code: string;
  qr_code_data: string;
}

export interface ReceiptGenerationRequest {
  payment_id: string;
  format: 'pdf' | 'json' | 'html';
  language: 'fr' | 'en';
}

export interface ReceiptGenerationResponse {
  receipt_number: string;
  receipt_url: string;
  receipt_data: ReceiptData;
}

// ============================================
// STATUS CHECKING
// ============================================

export interface PaymentStatusRequest {
  /** Payment ID to check */
  payment_id?: string;
  /** Client reference to check */
  client_reference?: string;
  /** Provider reference to check */
  provider_reference?: string;
}

export interface PaymentStatusResponse {
  payment_id: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  provider_status: string | null;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  receipt_number: string | null;
  receipt_url: string | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a unique receipt number
 *
 * Format: GST-YYYYMMDD-XXXXX
 * GST = Gestoo (prefix)
 * YYYYMMDD = Date
 * XXXXX = Random alphanumeric
 *
 * @returns Unique receipt number
 */
export function generateReceiptNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();

  return `GST-${year}${month}${day}-${random}`;
}

/**
 * Generate a client reference for tracking payments
 *
 * @param prefix - Optional prefix (e.g., 'TPT' for tax payments)
 * @returns Unique client reference
 */
export function generateClientReference(prefix: string = 'PAY'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate a verification code for receipt validation
 *
 * @param paymentId - Payment ID
 * @param amount - Payment amount
 * @returns Verification code
 */
export function generateVerificationCode(paymentId: string, amount: number): string {
  // Simple hash-like verification code
  const input = `${paymentId}-${amount}-${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase().substring(0, 8);
}

/**
 * Generate QR code data for receipt verification
 *
 * @param receiptNumber - Receipt number
 * @param verificationCode - Verification code
 * @param amount - Payment amount
 * @returns QR code data string (URL)
 */
export function generateQRCodeData(
  receiptNumber: string,
  verificationCode: string,
  amount: number
): string {
  const baseUrl = process.env.PUBLIC_APP_URL || 'https://gestoo.sn';
  return `${baseUrl}/verify/${receiptNumber}?code=${verificationCode}&amt=${amount}`;
}

/**
 * Check if a payment status is terminal (final)
 *
 * @param status - Payment status
 * @returns True if status is terminal
 */
export function isTerminalStatus(status: PaymentStatus): boolean {
  return ['completed', 'failed', 'cancelled', 'refunded', 'expired'].includes(status);
}

/**
 * Check if a payment can be refunded
 *
 * @param status - Payment status
 * @param completedAt - Completion timestamp
 * @param maxRefundDays - Maximum days to allow refund (default 30)
 * @returns True if refundable
 */
export function isRefundable(
  status: PaymentStatus,
  completedAt: string | null,
  maxRefundDays: number = 30
): boolean {
  if (status !== 'completed') {
    return false;
  }

  if (!completedAt) {
    return false;
  }

  const completedDate = new Date(completedAt);
  const now = new Date();
  const daysSinceCompletion = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceCompletion <= maxRefundDays;
}

/**
 * Format amount for display
 *
 * @param amount - Amount in smallest currency unit
 * @param currency - Currency code
 * @param locale - Locale for formatting (default 'fr-SN')
 * @returns Formatted amount string
 */
export function formatAmount(
  amount: number,
  currency: string = 'XOF',
  locale: string = 'fr-SN'
): string {
  // XOF doesn't use decimals
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === 'XOF' ? 0 : 2,
  };

  try {
    return new Intl.NumberFormat(locale, options).format(amount);
  } catch {
    // Fallback formatting
    return `${amount.toLocaleString()} ${currency}`;
  }
}

/**
 * Format amount with FCFA suffix (common in Senegal)
 *
 * @param amount - Amount
 * @returns Formatted string like "10,000 FCFA"
 */
export function formatAmountFCFA(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

/**
 * Get human-readable payment provider name
 *
 * @param provider - Payment provider code
 * @returns Human-readable name
 */
export function getProviderDisplayName(provider: PaymentProvider): string {
  const names: Record<PaymentProvider, string> = {
    wave: 'Wave',
    orange_money: 'Orange Money',
    card: 'Carte bancaire',
    bank_transfer: 'Virement bancaire',
  };
  return names[provider] || provider;
}

/**
 * Get human-readable payment status (French)
 *
 * @param status - Payment status
 * @returns Human-readable status in French
 */
export function getStatusDisplayName(status: PaymentStatus): string {
  const names: Record<PaymentStatus, string> = {
    pending: 'En attente',
    processing: 'En cours',
    completed: 'Complete',
    failed: 'Echoue',
    cancelled: 'Annule',
    refunded: 'Rembourse',
    expired: 'Expire',
  };
  return names[status] || status;
}

/**
 * Get status color for UI display
 *
 * @param status - Payment status
 * @returns Tailwind/CSS color class
 */
export function getStatusColor(status: PaymentStatus): string {
  const colors: Record<PaymentStatus, string> = {
    pending: 'yellow',
    processing: 'blue',
    completed: 'green',
    failed: 'red',
    cancelled: 'gray',
    refunded: 'purple',
    expired: 'gray',
  };
  return colors[status] || 'gray';
}

// ============================================
// PAYMENT ERROR CODES
// ============================================

export const PAYMENT_ERROR_CODES = {
  // General errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  TIMEOUT: 'TIMEOUT',

  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  API_KEY_INVALID: 'API_KEY_INVALID',
  API_KEY_REVOKED: 'API_KEY_REVOKED',

  // Payment errors
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  BLOCKED_ACCOUNT: 'BLOCKED_ACCOUNT',
  INVALID_PHONE: 'INVALID_PHONE',
  AMOUNT_TOO_LOW: 'AMOUNT_TOO_LOW',
  AMOUNT_TOO_HIGH: 'AMOUNT_TOO_HIGH',
  DAILY_LIMIT_EXCEEDED: 'DAILY_LIMIT_EXCEEDED',
  MONTHLY_LIMIT_EXCEEDED: 'MONTHLY_LIMIT_EXCEEDED',

  // Session errors
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',

  // Refund errors
  REFUND_NOT_ALLOWED: 'REFUND_NOT_ALLOWED',
  REFUND_AMOUNT_EXCEEDED: 'REFUND_AMOUNT_EXCEEDED',
  REFUND_TIME_EXCEEDED: 'REFUND_TIME_EXCEEDED',

  // Webhook errors
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  DUPLICATE_EVENT: 'DUPLICATE_EVENT',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
} as const;

export type PaymentErrorCode = typeof PAYMENT_ERROR_CODES[keyof typeof PAYMENT_ERROR_CODES];

/**
 * Get user-friendly error message (French)
 *
 * @param errorCode - Error code
 * @returns User-friendly message
 */
export function getPaymentErrorMessage(errorCode: string): string {
  const messages: Record<string, string> = {
    [PAYMENT_ERROR_CODES.INVALID_REQUEST]: 'Requete invalide. Veuillez verifier les informations.',
    [PAYMENT_ERROR_CODES.INTERNAL_ERROR]: 'Erreur interne. Veuillez reessayer.',
    [PAYMENT_ERROR_CODES.PROVIDER_ERROR]: 'Erreur du fournisseur de paiement.',
    [PAYMENT_ERROR_CODES.TIMEOUT]: 'Delai d\'attente depasse. Veuillez reessayer.',
    [PAYMENT_ERROR_CODES.INVALID_CREDENTIALS]: 'Identifiants invalides.',
    [PAYMENT_ERROR_CODES.API_KEY_INVALID]: 'Cle API invalide.',
    [PAYMENT_ERROR_CODES.API_KEY_REVOKED]: 'Cle API revoquee.',
    [PAYMENT_ERROR_CODES.INSUFFICIENT_FUNDS]: 'Solde insuffisant.',
    [PAYMENT_ERROR_CODES.BLOCKED_ACCOUNT]: 'Compte bloque. Contactez votre fournisseur.',
    [PAYMENT_ERROR_CODES.INVALID_PHONE]: 'Numero de telephone invalide.',
    [PAYMENT_ERROR_CODES.AMOUNT_TOO_LOW]: 'Montant trop bas.',
    [PAYMENT_ERROR_CODES.AMOUNT_TOO_HIGH]: 'Montant trop eleve.',
    [PAYMENT_ERROR_CODES.DAILY_LIMIT_EXCEEDED]: 'Limite journaliere atteinte.',
    [PAYMENT_ERROR_CODES.MONTHLY_LIMIT_EXCEEDED]: 'Limite mensuelle atteinte.',
    [PAYMENT_ERROR_CODES.SESSION_EXPIRED]: 'Session de paiement expiree.',
    [PAYMENT_ERROR_CODES.SESSION_NOT_FOUND]: 'Session de paiement introuvable.',
    [PAYMENT_ERROR_CODES.REFUND_NOT_ALLOWED]: 'Remboursement non autorise.',
    [PAYMENT_ERROR_CODES.REFUND_AMOUNT_EXCEEDED]: 'Montant de remboursement trop eleve.',
    [PAYMENT_ERROR_CODES.REFUND_TIME_EXCEEDED]: 'Delai de remboursement depasse.',
    [PAYMENT_ERROR_CODES.INVALID_SIGNATURE]: 'Signature invalide.',
    [PAYMENT_ERROR_CODES.DUPLICATE_EVENT]: 'Evenement en double.',
    [PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND]: 'Paiement introuvable.',
  };

  return messages[errorCode] || 'Une erreur est survenue. Veuillez reessayer.';
}

// ============================================
// CONSTANTS
// ============================================

/** TPT (Taxe de Promotion Touristique) rate per guest night in FCFA */
export const TPT_RATE_PER_NIGHT = 1000;

/** Default currency for Senegal */
export const DEFAULT_CURRENCY = 'XOF';

/** Minimum payment amount in FCFA */
export const MIN_PAYMENT_AMOUNT = 100;

/** Maximum payment amount in FCFA */
export const MAX_PAYMENT_AMOUNT = 10000000; // 10 million FCFA

/** Payment session timeout in minutes */
export const PAYMENT_SESSION_TIMEOUT_MINUTES = 30;

/** Maximum refund period in days */
export const MAX_REFUND_PERIOD_DAYS = 30;

/** Wave payout reversal limit in days */
export const WAVE_PAYOUT_REVERSAL_LIMIT_DAYS = 3;

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate payment amount
 *
 * @param amount - Amount to validate
 * @returns Validation result with error message if invalid
 */
export function validatePaymentAmount(amount: number): { valid: boolean; error?: string } {
  if (!amount || typeof amount !== 'number') {
    return { valid: false, error: 'Montant invalide' };
  }

  if (amount < MIN_PAYMENT_AMOUNT) {
    return { valid: false, error: `Montant minimum: ${formatAmountFCFA(MIN_PAYMENT_AMOUNT)}` };
  }

  if (amount > MAX_PAYMENT_AMOUNT) {
    return { valid: false, error: `Montant maximum: ${formatAmountFCFA(MAX_PAYMENT_AMOUNT)}` };
  }

  if (!Number.isInteger(amount)) {
    return { valid: false, error: 'Le montant doit etre un nombre entier (FCFA)' };
  }

  return { valid: true };
}

/**
 * Validate Senegalese phone number
 *
 * Valid formats:
 * - +221XXXXXXXXX (E.164)
 * - 221XXXXXXXXX
 * - 7XXXXXXXX (local)
 *
 * @param phone - Phone number to validate
 * @returns Validation result
 */
export function validateSenegalPhone(phone: string): { valid: boolean; error?: string } {
  if (!phone) {
    return { valid: false, error: 'Numero de telephone requis' };
  }

  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s-]/g, '');

  // E.164 format: +221 followed by 9 digits
  const e164Pattern = /^\+221[0-9]{9}$/;

  // Without + but with country code
  const withCountryCodePattern = /^221[0-9]{9}$/;

  // Local format: starts with 7 and has 9 digits
  const localPattern = /^7[0-9]{8}$/;

  if (e164Pattern.test(cleaned) || withCountryCodePattern.test(cleaned) || localPattern.test(cleaned)) {
    return { valid: true };
  }

  return { valid: false, error: 'Format de numero invalide. Exemple: +221771234567' };
}

/**
 * Normalize phone number to E.164 format
 *
 * @param phone - Phone number in any valid format
 * @returns E.164 formatted phone number
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, '');

  if (cleaned.startsWith('+221')) {
    return cleaned;
  }

  if (cleaned.startsWith('221')) {
    return '+' + cleaned;
  }

  if (cleaned.startsWith('7') && cleaned.length === 9) {
    return '+221' + cleaned;
  }

  // Return as-is if format is unknown
  return cleaned;
}

// ============================================
// RECEIPT HTML TEMPLATE
// ============================================

/**
 * Generate HTML receipt for printing/PDF
 *
 * @param receipt - Receipt data
 * @returns HTML string
 */
export function generateReceiptHTML(receipt: ReceiptData): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recu de Paiement - ${receipt.receipt_number}</title>
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      max-width: 400px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .receipt {
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #008751;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    .header h1 {
      color: #008751;
      margin: 0;
      font-size: 24px;
    }
    .header p {
      margin: 4px 0;
      color: #666;
      font-size: 12px;
    }
    .receipt-number {
      background: #f0f9f4;
      padding: 8px;
      text-align: center;
      font-family: monospace;
      font-size: 14px;
      margin-bottom: 16px;
      border-radius: 4px;
    }
    .section {
      margin-bottom: 16px;
    }
    .section-title {
      font-weight: bold;
      color: #333;
      margin-bottom: 8px;
      font-size: 14px;
      text-transform: uppercase;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 13px;
    }
    .row .label {
      color: #666;
    }
    .row .value {
      font-weight: 500;
    }
    .total {
      border-top: 2px solid #008751;
      padding-top: 12px;
      margin-top: 12px;
    }
    .total .row {
      font-size: 16px;
      font-weight: bold;
    }
    .total .value {
      color: #008751;
    }
    .qr-code {
      text-align: center;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px dashed #ccc;
    }
    .qr-code img {
      width: 120px;
      height: 120px;
    }
    .verification {
      text-align: center;
      font-size: 10px;
      color: #999;
      margin-top: 8px;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #eee;
      font-size: 11px;
      color: #999;
    }
    .footer .flag {
      font-size: 24px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>GESTOO</h1>
      <p>Republique du Senegal</p>
      <p>Ministere du Tourisme</p>
    </div>

    <div class="receipt-number">
      <strong>RECU N: ${receipt.receipt_number}</strong>
    </div>

    <div class="section">
      <div class="section-title">Paiement</div>
      <div class="row">
        <span class="label">Date:</span>
        <span class="value">${new Date(receipt.payment.completed_at).toLocaleDateString('fr-FR')}</span>
      </div>
      <div class="row">
        <span class="label">Mode:</span>
        <span class="value">${getProviderDisplayName(receipt.payment.provider)}</span>
      </div>
      <div class="row">
        <span class="label">Reference:</span>
        <span class="value">${receipt.payment.transaction_id || '-'}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Contribuable</div>
      <div class="row">
        <span class="label">Nom:</span>
        <span class="value">${receipt.payer.name}</span>
      </div>
      ${receipt.payer.business_name ? `
      <div class="row">
        <span class="label">Entreprise:</span>
        <span class="value">${receipt.payer.business_name}</span>
      </div>
      ` : ''}
      ${receipt.payer.ninea ? `
      <div class="row">
        <span class="label">NINEA:</span>
        <span class="value">${receipt.payer.ninea}</span>
      </div>
      ` : ''}
    </div>

    <div class="section">
      <div class="section-title">Propriete</div>
      <div class="row">
        <span class="label">Nom:</span>
        <span class="value">${receipt.property.name}</span>
      </div>
      <div class="row">
        <span class="label">Licence:</span>
        <span class="value">${receipt.property.license_number || 'En cours'}</span>
      </div>
      <div class="row">
        <span class="label">Adresse:</span>
        <span class="value">${receipt.property.city}, ${receipt.property.region}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Taxe de Promotion Touristique (TPT)</div>
      ${receipt.tax.period_start && receipt.tax.period_end ? `
      <div class="row">
        <span class="label">Periode:</span>
        <span class="value">${new Date(receipt.tax.period_start).toLocaleDateString('fr-FR')} - ${new Date(receipt.tax.period_end).toLocaleDateString('fr-FR')}</span>
      </div>
      ` : ''}
      <div class="row">
        <span class="label">Nuitees:</span>
        <span class="value">${receipt.tax.guest_nights}</span>
      </div>
      <div class="row">
        <span class="label">Taux/nuit:</span>
        <span class="value">${formatAmountFCFA(receipt.tax.rate_per_night)}</span>
      </div>
    </div>

    <div class="total">
      <div class="row">
        <span class="label">TOTAL PAYE:</span>
        <span class="value">${formatAmountFCFA(receipt.payment.amount)}</span>
      </div>
    </div>

    <div class="qr-code">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(receipt.qr_code_data)}" alt="QR Code">
      <div class="verification">
        Code de verification: ${receipt.verification_code}
      </div>
    </div>

    <div class="footer">
      <div class="flag">🇸🇳</div>
      <p>Merci pour votre contribution au developpement du tourisme senegalais</p>
      <p>Ce recu est delivre par Gestoo pour le compte du Tresor Public</p>
    </div>
  </div>
</body>
</html>
`;
}

// ============================================
// EXPORTS
// ============================================

export default {
  generateReceiptNumber,
  generateClientReference,
  generateVerificationCode,
  generateQRCodeData,
  isTerminalStatus,
  isRefundable,
  formatAmount,
  formatAmountFCFA,
  getProviderDisplayName,
  getStatusDisplayName,
  getStatusColor,
  getPaymentErrorMessage,
  validatePaymentAmount,
  validateSenegalPhone,
  normalizePhone,
  generateReceiptHTML,
  PAYMENT_ERROR_CODES,
  TPT_RATE_PER_NIGHT,
  DEFAULT_CURRENCY,
  MIN_PAYMENT_AMOUNT,
  MAX_PAYMENT_AMOUNT,
  PAYMENT_SESSION_TIMEOUT_MINUTES,
  MAX_REFUND_PERIOD_DAYS,
  WAVE_PAYOUT_REVERSAL_LIMIT_DAYS,
};
