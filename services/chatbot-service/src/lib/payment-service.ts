/**
 * Unified Payment Service for Gestoo
 *
 * This service provides a unified interface for both Wave and Orange Money
 * payment providers, handling:
 * - Payment initiation
 * - Status checking
 * - Webhook processing
 * - Receipt generation
 * - Refund processing
 * - Retry logic for failed payments
 *
 * @module payment-service
 */

import { supabase } from './supabase.js';
import {
  getWaveClient,
  formatWaveAmount,
  formatWavePhone,
  generateIdempotencyKey,
  parseWaveWebhook,
  verifyWaveWebhookSignature,
  getWaveErrorMessage,
  isCheckoutRefundable,
  type WaveCheckoutSession,
  type WaveWebhookEvent,
  type WaveCurrency,
} from './wave.js';
import {
  initiatePayment as initiateOrangePayment,
  checkTransactionStatus as checkOrangeStatus,
  parseWebhookPayload as parseOrangeWebhook,
  verifyWebhookSignature as verifyOrangeSignature,
  getErrorMessage as getOrangeErrorMessage,
  isRetryableError as isOrangeRetryable,
  type OrangeMoneyStatus,
  type OrangeMoneyWebhookPayload,
  type OrangeMoneyError,
} from './orange-money.js';
import {
  type PaymentProvider,
  type PaymentStatus,
  type RefundStatus,
  type PaymentRecord,
  type PaymentMetadata,
  type ReceiptData,
  type WebhookEventType,
  generateReceiptNumber,
  generateClientReference,
  generateVerificationCode,
  generateQRCodeData,
  isTerminalStatus,
  isRefundable,
  formatAmountFCFA,
  getProviderDisplayName,
  validatePaymentAmount,
  normalizePhone,
  PAYMENT_ERROR_CODES,
  DEFAULT_CURRENCY,
} from '@gestoo/shared-types/payments';

// ============================================
// TYPES
// ============================================

export interface InitiatePaymentOptions {
  /** Payment provider */
  provider: PaymentProvider;
  /** Amount in FCFA */
  amount: number;
  /** Client reference for tracking */
  reference?: string;
  /** Landlord ID */
  landlordId: string;
  /** Tax liability IDs being paid */
  liabilityIds?: string[];
  /** Payer phone number */
  payerPhone: string;
  /** Payer name */
  payerName?: string;
  /** Success redirect URL */
  successUrl?: string;
  /** Error/cancel redirect URL */
  errorUrl?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface PaymentInitiationResult {
  success: boolean;
  paymentId?: string;
  providerReference?: string;
  paymentUrl?: string;
  expiresAt?: string;
  error?: PaymentServiceError;
}

export interface PaymentStatusResult {
  paymentId: string;
  status: PaymentStatus;
  providerStatus?: string;
  amount: number;
  provider: PaymentProvider;
  transactionId?: string;
  completedAt?: string;
  error?: PaymentServiceError;
}

export interface RefundOptions {
  /** Payment ID to refund */
  paymentId: string;
  /** Amount to refund (partial refund if less than original) */
  amount?: number;
  /** Reason for refund */
  reason?: string;
  /** Idempotency key */
  idempotencyKey?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  status?: RefundStatus;
  error?: PaymentServiceError;
}

export interface WebhookHandlerResult {
  success: boolean;
  paymentId?: string;
  statusUpdated: boolean;
  newStatus?: PaymentStatus;
  error?: string;
}

export interface PaymentServiceError {
  code: string;
  message: string;
  provider?: PaymentProvider;
  retryable: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface ReceiptGenerationResult {
  success: boolean;
  receiptNumber?: string;
  receiptData?: ReceiptData;
  receiptUrl?: string;
  error?: string;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

const WAVE_WEBHOOK_SECRET = process.env.WAVE_WEBHOOK_SECRET || '';
const ORANGE_WEBHOOK_SECRET = process.env.ORANGE_MONEY_WEBHOOK_SECRET || '';
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://gestoo.sn';
const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/functions/v1`
  : '';

// ============================================
// UNIFIED PAYMENT SERVICE CLASS
// ============================================

export class PaymentService {
  private retryConfig: RetryConfig;

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  // ==========================================
  // PAYMENT INITIATION
  // ==========================================

  /**
   * Initiate a payment through the specified provider
   *
   * @param options - Payment options
   * @returns Payment initiation result
   */
  async initiatePayment(options: InitiatePaymentOptions): Promise<PaymentInitiationResult> {
    // Validate amount
    const amountValidation = validatePaymentAmount(options.amount);
    if (!amountValidation.valid) {
      return {
        success: false,
        error: {
          code: PAYMENT_ERROR_CODES.INVALID_REQUEST,
          message: amountValidation.error || 'Invalid amount',
          retryable: false,
        },
      };
    }

    // Generate client reference if not provided
    const clientReference = options.reference || generateClientReference('TPT');

    // Normalize phone number
    const normalizedPhone = normalizePhone(options.payerPhone);

    console.log('[PaymentService] Initiating payment:', {
      provider: options.provider,
      amount: options.amount,
      reference: clientReference,
      landlordId: options.landlordId,
    });

    try {
      switch (options.provider) {
        case 'wave':
          return await this.initiateWavePayment(options, clientReference, normalizedPhone);
        case 'orange_money':
          return await this.initiateOrangeMoneyPayment(options, clientReference, normalizedPhone);
        default:
          return {
            success: false,
            error: {
              code: PAYMENT_ERROR_CODES.INVALID_REQUEST,
              message: `Unsupported payment provider: ${options.provider}`,
              retryable: false,
            },
          };
      }
    } catch (error) {
      console.error('[PaymentService] Payment initiation error:', error);
      return {
        success: false,
        error: {
          code: PAYMENT_ERROR_CODES.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
      };
    }
  }

  /**
   * Initiate payment with automatic retry on transient failures
   */
  async initiatePaymentWithRetry(options: InitiatePaymentOptions): Promise<PaymentInitiationResult> {
    let lastError: PaymentServiceError | undefined;
    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      console.log(`[PaymentService] Attempt ${attempt}/${this.retryConfig.maxAttempts}`);

      const result = await this.initiatePayment(options);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      // Don't retry if error is not retryable
      if (!result.error?.retryable) {
        console.log('[PaymentService] Error is not retryable, stopping');
        return result;
      }

      // Wait before retrying (except on last attempt)
      if (attempt < this.retryConfig.maxAttempts) {
        console.log(`[PaymentService] Retrying in ${delay}ms...`);
        await this.delay(delay);
        delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
      }
    }

    return {
      success: false,
      error: lastError || {
        code: PAYMENT_ERROR_CODES.INTERNAL_ERROR,
        message: 'Max retry attempts exceeded',
        retryable: false,
      },
    };
  }

  private async initiateWavePayment(
    options: InitiatePaymentOptions,
    clientReference: string,
    normalizedPhone: string
  ): Promise<PaymentInitiationResult> {
    const waveClient = getWaveClient();
    const idempotencyKey = generateIdempotencyKey('wave');

    const successUrl = options.successUrl || `${APP_BASE_URL}/payment/success`;
    const errorUrl = options.errorUrl || `${APP_BASE_URL}/payment/error`;

    try {
      // Create Wave checkout session
      const session = await waveClient.createCheckoutSession(
        {
          amount: formatWaveAmount(options.amount, 'XOF'),
          currency: 'XOF' as WaveCurrency,
          success_url: successUrl,
          error_url: errorUrl,
          client_reference: clientReference,
          restrict_payer_mobile: normalizedPhone,
        },
        idempotencyKey
      );

      // Store payment record in Supabase
      const paymentRecord = await this.createPaymentRecord({
        landlordId: options.landlordId,
        amount: options.amount,
        provider: 'wave',
        providerReference: session.id,
        clientReference,
        payerPhone: normalizedPhone,
        payerName: options.payerName,
        liabilityIds: options.liabilityIds,
        metadata: {
          wave_checkout_id: session.id,
          wave_launch_url: session.wave_launch_url,
          idempotency_key: idempotencyKey,
          ...options.metadata,
        },
      });

      if (!paymentRecord) {
        return {
          success: false,
          error: {
            code: PAYMENT_ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create payment record',
            retryable: true,
          },
        };
      }

      console.log('[PaymentService] Wave payment initiated:', {
        paymentId: paymentRecord.id,
        sessionId: session.id,
      });

      return {
        success: true,
        paymentId: paymentRecord.id,
        providerReference: session.id,
        paymentUrl: session.wave_launch_url,
        expiresAt: session.when_expires,
      };
    } catch (error: any) {
      const errorCode = error.code || 'WAVE_API_ERROR';
      const isRetryable = ['rate-limit-exceeded', 'api-timeout'].includes(errorCode);

      return {
        success: false,
        error: {
          code: errorCode,
          message: getWaveErrorMessage(errorCode),
          provider: 'wave',
          retryable: isRetryable,
        },
      };
    }
  }

  private async initiateOrangeMoneyPayment(
    options: InitiatePaymentOptions,
    clientReference: string,
    normalizedPhone: string
  ): Promise<PaymentInitiationResult> {
    const successUrl = options.successUrl || `${APP_BASE_URL}/payment/success`;
    const cancelUrl = options.errorUrl || `${APP_BASE_URL}/payment/cancel`;
    const notifyUrl = `${SUPABASE_FUNCTIONS_URL}/payment-webhook?provider=orange_money`;

    try {
      const result = await initiateOrangePayment({
        amount: options.amount,
        orderId: clientReference,
        reference: `TPT-${options.landlordId.substring(0, 8)}`,
        returnUrl: successUrl,
        cancelUrl,
        notifyUrl,
        language: 'fr',
        metadata: {
          landlord_id: options.landlordId,
          liability_ids: options.liabilityIds,
          payer_phone: normalizedPhone,
          ...options.metadata,
        },
      });

      if (!result.success || !result.payToken) {
        const error = result.error as OrangeMoneyError | undefined;
        return {
          success: false,
          error: {
            code: error?.code || PAYMENT_ERROR_CODES.PROVIDER_ERROR,
            message: error ? getOrangeErrorMessage(error, 'fr') : 'Orange Money payment failed',
            provider: 'orange_money',
            retryable: error ? isOrangeRetryable(error) : false,
          },
        };
      }

      // Store payment record in Supabase
      const paymentRecord = await this.createPaymentRecord({
        landlordId: options.landlordId,
        amount: options.amount,
        provider: 'orange_money',
        providerReference: result.payToken,
        clientReference,
        payerPhone: normalizedPhone,
        payerName: options.payerName,
        liabilityIds: options.liabilityIds,
        metadata: {
          orange_order_id: result.orderId,
          orange_pay_token: result.payToken,
          orange_notif_token: result.notifToken,
          orange_payment_url: result.paymentUrl,
          ...options.metadata,
        },
      });

      if (!paymentRecord) {
        return {
          success: false,
          error: {
            code: PAYMENT_ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create payment record',
            retryable: true,
          },
        };
      }

      console.log('[PaymentService] Orange Money payment initiated:', {
        paymentId: paymentRecord.id,
        orderId: result.orderId,
      });

      return {
        success: true,
        paymentId: paymentRecord.id,
        providerReference: result.payToken,
        paymentUrl: result.paymentUrl,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: PAYMENT_ERROR_CODES.PROVIDER_ERROR,
          message: error.message || 'Orange Money API error',
          provider: 'orange_money',
          retryable: true,
        },
      };
    }
  }

  // ==========================================
  // STATUS CHECKING
  // ==========================================

  /**
   * Check the status of a payment
   *
   * @param provider - Payment provider
   * @param reference - Payment reference (payment ID or provider reference)
   * @returns Payment status result
   */
  async checkStatus(provider: PaymentProvider, reference: string): Promise<PaymentStatusResult> {
    console.log('[PaymentService] Checking status:', { provider, reference });

    // First, try to find the payment record
    const payment = await this.findPaymentByReference(reference);

    if (!payment) {
      return {
        paymentId: reference,
        status: 'failed',
        amount: 0,
        provider,
        error: {
          code: PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND,
          message: 'Payment not found',
          retryable: false,
        },
      };
    }

    // If payment is already in terminal state, return cached status
    if (isTerminalStatus(payment.status)) {
      return {
        paymentId: payment.id,
        status: payment.status,
        providerStatus: payment.metadata?.provider_status as string,
        amount: payment.amount,
        provider: payment.provider,
        transactionId: payment.provider_transaction_id || undefined,
        completedAt: payment.completed_at || undefined,
      };
    }

    // Check with provider for non-terminal statuses
    try {
      switch (provider) {
        case 'wave':
          return await this.checkWaveStatus(payment);
        case 'orange_money':
          return await this.checkOrangeMoneyStatus(payment);
        default:
          return {
            paymentId: payment.id,
            status: payment.status,
            amount: payment.amount,
            provider: payment.provider,
          };
      }
    } catch (error) {
      console.error('[PaymentService] Status check error:', error);
      return {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        provider: payment.provider,
        error: {
          code: PAYMENT_ERROR_CODES.PROVIDER_ERROR,
          message: error instanceof Error ? error.message : 'Status check failed',
          retryable: true,
        },
      };
    }
  }

  private async checkWaveStatus(payment: PaymentRecord): Promise<PaymentStatusResult> {
    const waveClient = getWaveClient();
    const checkoutId = payment.metadata?.wave_checkout_id as string;

    if (!checkoutId) {
      return {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        provider: 'wave',
      };
    }

    const session = await waveClient.getCheckoutSession(checkoutId);
    const newStatus = this.mapWaveStatus(session.checkout_status, session.payment_status);

    // Update payment record if status changed
    if (newStatus !== payment.status) {
      await this.updatePaymentStatus(payment.id, newStatus, {
        wave_transaction_id: session.transaction_id,
        provider_status: session.payment_status,
      });
    }

    return {
      paymentId: payment.id,
      status: newStatus,
      providerStatus: session.payment_status || session.checkout_status,
      amount: payment.amount,
      provider: 'wave',
      transactionId: session.transaction_id || undefined,
      completedAt: session.when_completed || undefined,
    };
  }

  private async checkOrangeMoneyStatus(payment: PaymentRecord): Promise<PaymentStatusResult> {
    const orderId = payment.metadata?.orange_order_id as string;
    const payToken = payment.metadata?.orange_pay_token as string;

    if (!orderId || !payToken) {
      return {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        provider: 'orange_money',
      };
    }

    const statusResponse = await checkOrangeStatus(orderId, payment.amount, payToken);
    const newStatus = this.mapOrangeStatus(statusResponse.status);

    // Update payment record if status changed
    if (newStatus !== payment.status) {
      await this.updatePaymentStatus(payment.id, newStatus, {
        orange_txn_id: statusResponse.txnid,
        provider_status: statusResponse.status,
      });
    }

    return {
      paymentId: payment.id,
      status: newStatus,
      providerStatus: statusResponse.status,
      amount: payment.amount,
      provider: 'orange_money',
      transactionId: statusResponse.txnid || undefined,
    };
  }

  // ==========================================
  // WEBHOOK HANDLING
  // ==========================================

  /**
   * Handle incoming webhook from payment provider
   *
   * @param provider - Payment provider
   * @param payload - Raw webhook payload
   * @param headers - Webhook headers for signature verification
   * @returns Webhook processing result
   */
  async handleWebhook(
    provider: PaymentProvider,
    payload: string,
    headers: Record<string, string>
  ): Promise<WebhookHandlerResult> {
    console.log('[PaymentService] Processing webhook:', { provider });

    try {
      switch (provider) {
        case 'wave':
          return await this.handleWaveWebhook(payload, headers);
        case 'orange_money':
          return await this.handleOrangeMoneyWebhook(payload, headers);
        default:
          return {
            success: false,
            statusUpdated: false,
            error: `Unsupported provider: ${provider}`,
          };
      }
    } catch (error) {
      console.error('[PaymentService] Webhook handling error:', error);
      return {
        success: false,
        statusUpdated: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed',
      };
    }
  }

  private async handleWaveWebhook(
    payload: string,
    headers: Record<string, string>
  ): Promise<WebhookHandlerResult> {
    const signatureHeader = headers['wave-signature'] || headers['Wave-Signature'];
    const authHeader = headers['authorization'] || headers['Authorization'];

    // Parse and verify webhook
    const event = parseWaveWebhook(
      payload,
      signatureHeader || null,
      authHeader || null,
      WAVE_WEBHOOK_SECRET,
      signatureHeader ? 'signing_secret' : 'shared_secret'
    );

    if (!event) {
      return {
        success: false,
        statusUpdated: false,
        error: 'Invalid Wave webhook signature or payload',
      };
    }

    console.log('[PaymentService] Wave webhook event:', { type: event.type, id: event.id });

    // Handle checkout session events
    if (event.type.startsWith('checkout.session.')) {
      const sessionData = event.data as WaveCheckoutSession;
      const payment = await this.findPaymentByProviderReference(sessionData.id, 'wave');

      if (!payment) {
        console.warn('[PaymentService] Payment not found for Wave session:', sessionData.id);
        return {
          success: true,
          statusUpdated: false,
          error: 'Payment not found',
        };
      }

      const newStatus = this.mapWaveStatus(sessionData.checkout_status, sessionData.payment_status);

      // Update payment record
      await this.updatePaymentStatus(payment.id, newStatus, {
        wave_transaction_id: sessionData.transaction_id,
        provider_status: sessionData.payment_status,
        webhook_events: [...(payment.metadata?.webhook_events || []), event.id],
      });

      // Generate receipt if payment completed
      if (newStatus === 'completed') {
        await this.generateReceiptForPayment(payment.id);
      }

      return {
        success: true,
        paymentId: payment.id,
        statusUpdated: true,
        newStatus,
      };
    }

    return {
      success: true,
      statusUpdated: false,
    };
  }

  private async handleOrangeMoneyWebhook(
    payload: string,
    headers: Record<string, string>
  ): Promise<WebhookHandlerResult> {
    const signature = headers['x-orange-signature'] || headers['X-Orange-Signature'];

    // Parse and verify webhook
    const webhookData = parseOrangeWebhook(payload, signature);

    if (!webhookData) {
      return {
        success: false,
        statusUpdated: false,
        error: 'Invalid Orange Money webhook signature or payload',
      };
    }

    console.log('[PaymentService] Orange Money webhook:', {
      status: webhookData.status,
      orderId: webhookData.order_id,
    });

    // Find payment by order ID
    const payment = await this.findPaymentByClientReference(webhookData.order_id);

    if (!payment) {
      console.warn('[PaymentService] Payment not found for order:', webhookData.order_id);
      return {
        success: true,
        statusUpdated: false,
        error: 'Payment not found',
      };
    }

    const newStatus = this.mapOrangeStatus(webhookData.status);

    // Update payment record
    await this.updatePaymentStatus(payment.id, newStatus, {
      orange_txn_id: webhookData.txnid,
      provider_status: webhookData.status,
    });

    // Generate receipt if payment completed
    if (newStatus === 'completed') {
      await this.generateReceiptForPayment(payment.id);
    }

    return {
      success: true,
      paymentId: payment.id,
      statusUpdated: true,
      newStatus,
    };
  }

  // ==========================================
  // REFUNDS
  // ==========================================

  /**
   * Process a refund for a payment
   *
   * @param options - Refund options
   * @returns Refund result
   */
  async processRefund(options: RefundOptions): Promise<RefundResult> {
    console.log('[PaymentService] Processing refund:', { paymentId: options.paymentId });

    // Find the payment
    const payment = await this.findPaymentById(options.paymentId);

    if (!payment) {
      return {
        success: false,
        error: {
          code: PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND,
          message: 'Payment not found',
          retryable: false,
        },
      };
    }

    // Check if refundable
    if (!isRefundable(payment.status, payment.completed_at)) {
      return {
        success: false,
        error: {
          code: PAYMENT_ERROR_CODES.REFUND_NOT_ALLOWED,
          message: 'Payment cannot be refunded',
          retryable: false,
        },
      };
    }

    // Validate refund amount
    const refundAmount = options.amount || payment.amount;
    if (refundAmount > payment.amount) {
      return {
        success: false,
        error: {
          code: PAYMENT_ERROR_CODES.REFUND_AMOUNT_EXCEEDED,
          message: 'Refund amount exceeds original payment',
          retryable: false,
        },
      };
    }

    try {
      switch (payment.provider) {
        case 'wave':
          return await this.processWaveRefund(payment, refundAmount, options);
        case 'orange_money':
          return await this.processOrangeMoneyRefund(payment, refundAmount, options);
        default:
          return {
            success: false,
            error: {
              code: PAYMENT_ERROR_CODES.INVALID_REQUEST,
              message: `Refunds not supported for provider: ${payment.provider}`,
              retryable: false,
            },
          };
      }
    } catch (error) {
      console.error('[PaymentService] Refund error:', error);
      return {
        success: false,
        error: {
          code: PAYMENT_ERROR_CODES.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Refund failed',
          retryable: true,
        },
      };
    }
  }

  private async processWaveRefund(
    payment: PaymentRecord,
    amount: number,
    options: RefundOptions
  ): Promise<RefundResult> {
    const waveClient = getWaveClient();
    const checkoutId = payment.metadata?.wave_checkout_id as string;

    if (!checkoutId) {
      return {
        success: false,
        error: {
          code: PAYMENT_ERROR_CODES.INTERNAL_ERROR,
          message: 'Missing Wave checkout ID',
          retryable: false,
        },
      };
    }

    const idempotencyKey = options.idempotencyKey || generateIdempotencyKey('refund');

    const refundResult = await waveClient.refundCheckoutSession(
      checkoutId,
      amount < payment.amount ? { amount: formatWaveAmount(amount, 'XOF') } : {},
      idempotencyKey
    );

    // Create refund record
    const refundRecord = await this.createRefundRecord({
      paymentId: payment.id,
      amount,
      reason: options.reason,
      providerReference: refundResult.transaction_id || checkoutId,
      status: 'completed',
    });

    // Update payment status
    await this.updatePaymentStatus(payment.id, 'refunded', {
      refund_id: refundRecord?.id,
      refund_amount: amount,
      refund_reason: options.reason,
    });

    return {
      success: true,
      refundId: refundRecord?.id,
      amount,
      status: 'completed',
    };
  }

  private async processOrangeMoneyRefund(
    payment: PaymentRecord,
    amount: number,
    options: RefundOptions
  ): Promise<RefundResult> {
    // Orange Money doesn't have a direct refund API
    // Refunds are typically done via payout to the customer's phone number
    const payerPhone = payment.metadata?.payer_phone as string;

    if (!payerPhone) {
      return {
        success: false,
        error: {
          code: PAYMENT_ERROR_CODES.INTERNAL_ERROR,
          message: 'Missing payer phone number for refund',
          retryable: false,
        },
      };
    }

    // For Orange Money, we need to initiate a payout through Wave
    // This is a business decision - refunds could be manual or through another channel
    console.warn('[PaymentService] Orange Money refund requires manual processing or payout');

    // Create a pending refund record for manual processing
    const refundRecord = await this.createRefundRecord({
      paymentId: payment.id,
      amount,
      reason: options.reason,
      status: 'pending',
    });

    return {
      success: true,
      refundId: refundRecord?.id,
      amount,
      status: 'pending',
    };
  }

  // ==========================================
  // RECEIPT GENERATION
  // ==========================================

  /**
   * Generate a receipt for a completed payment
   *
   * @param paymentId - Payment ID
   * @returns Receipt generation result
   */
  async generateReceiptForPayment(paymentId: string): Promise<ReceiptGenerationResult> {
    console.log('[PaymentService] Generating receipt for payment:', paymentId);

    const payment = await this.findPaymentById(paymentId);

    if (!payment) {
      return {
        success: false,
        error: 'Payment not found',
      };
    }

    if (payment.status !== 'completed') {
      return {
        success: false,
        error: 'Receipt can only be generated for completed payments',
      };
    }

    // Check if receipt already exists
    if (payment.receipt_number) {
      return {
        success: true,
        receiptNumber: payment.receipt_number,
        receiptUrl: payment.receipt_url || undefined,
      };
    }

    try {
      // Fetch related data
      const [landlordData, liabilityData, propertyData] = await Promise.all([
        this.fetchLandlordData(payment.landlord_id),
        this.fetchLiabilityData(payment.metadata?.liability_ids as string[] || []),
        this.fetchPropertyData(payment.landlord_id),
      ]);

      // Generate receipt data
      const receiptNumber = generateReceiptNumber();
      const verificationCode = generateVerificationCode(paymentId, payment.amount);
      const qrCodeData = generateQRCodeData(receiptNumber, verificationCode, payment.amount);

      const receiptData: ReceiptData = {
        receipt_number: receiptNumber,
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          provider: payment.provider,
          transaction_id: payment.provider_transaction_id,
          completed_at: payment.completed_at || new Date().toISOString(),
        },
        payer: {
          name: landlordData?.full_name || payment.metadata?.payer_name as string || 'N/A',
          phone: payment.metadata?.payer_phone as string || '',
          landlord_id: payment.landlord_id,
          business_name: landlordData?.business_name || null,
          ninea: landlordData?.ninea || null,
          address: landlordData?.address || null,
        },
        tax: {
          type: 'TPT',
          period_start: liabilityData?.period_start || null,
          period_end: liabilityData?.period_end || null,
          guest_nights: liabilityData?.guest_nights || 0,
          rate_per_night: 1000,
          subtotal: payment.amount,
          total: payment.amount,
        },
        property: {
          id: propertyData?.id || '',
          name: propertyData?.name || 'N/A',
          license_number: propertyData?.license_number || null,
          address: propertyData?.address || '',
          city: propertyData?.city || '',
          region: propertyData?.region || '',
        },
        treasury: {
          reference: payment.treasury_reference,
          settled_at: payment.treasury_settled_at,
        },
        issued_at: new Date().toISOString(),
        valid_until: null,
        verification_code: verificationCode,
        qr_code_data: qrCodeData,
      };

      // Store receipt URL (could be a PDF generation service)
      const receiptUrl = `${APP_BASE_URL}/receipts/${receiptNumber}`;

      // Update payment with receipt info
      await supabase
        .from('payments')
        .update({
          receipt_number: receiptNumber,
          receipt_url: receiptUrl,
        })
        .eq('id', paymentId);

      // Store receipt record
      await supabase.from('receipts').insert({
        receipt_number: receiptNumber,
        payment_id: paymentId,
        landlord_id: payment.landlord_id,
        data: receiptData,
        verification_code: verificationCode,
        qr_code_data: qrCodeData,
        issued_at: receiptData.issued_at,
      });

      console.log('[PaymentService] Receipt generated:', receiptNumber);

      return {
        success: true,
        receiptNumber,
        receiptData,
        receiptUrl,
      };
    } catch (error) {
      console.error('[PaymentService] Receipt generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Receipt generation failed',
      };
    }
  }

  // ==========================================
  // PROVIDER SELECTION
  // ==========================================

  /**
   * Get preferred payment provider for a user
   *
   * @param landlordId - Landlord ID
   * @returns Preferred payment provider or default
   */
  async getPreferredProvider(landlordId: string): Promise<PaymentProvider> {
    try {
      const { data } = await supabase
        .from('landlords')
        .select('preferred_payment_method')
        .eq('id', landlordId)
        .single();

      if (data?.preferred_payment_method) {
        return data.preferred_payment_method as PaymentProvider;
      }
    } catch (error) {
      console.warn('[PaymentService] Could not fetch preferred provider:', error);
    }

    // Default to Wave (most popular in Senegal)
    return 'wave';
  }

  /**
   * Set preferred payment provider for a user
   *
   * @param landlordId - Landlord ID
   * @param provider - Payment provider
   */
  async setPreferredProvider(landlordId: string, provider: PaymentProvider): Promise<void> {
    await supabase
      .from('landlords')
      .update({ preferred_payment_method: provider })
      .eq('id', landlordId);
  }

  /**
   * Initiate payment using user's preferred provider
   *
   * @param options - Payment options (without provider)
   * @returns Payment initiation result
   */
  async initiatePaymentWithPreferredProvider(
    options: Omit<InitiatePaymentOptions, 'provider'>
  ): Promise<PaymentInitiationResult> {
    const provider = await this.getPreferredProvider(options.landlordId);
    return this.initiatePayment({ ...options, provider });
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private mapWaveStatus(
    checkoutStatus: string,
    paymentStatus: string | null
  ): PaymentStatus {
    if (checkoutStatus === 'complete' && paymentStatus === 'succeeded') {
      return 'completed';
    }
    if (checkoutStatus === 'expired') {
      return 'expired';
    }
    if (paymentStatus === 'cancelled') {
      return 'cancelled';
    }
    if (paymentStatus === 'processing') {
      return 'processing';
    }
    return 'pending';
  }

  private mapOrangeStatus(status: OrangeMoneyStatus): PaymentStatus {
    const statusMap: Record<OrangeMoneyStatus, PaymentStatus> = {
      INITIATED: 'pending',
      PENDING: 'processing',
      SUCCESS: 'completed',
      FAILED: 'failed',
      EXPIRED: 'expired',
      CANCELLED: 'cancelled',
    };
    return statusMap[status] || 'pending';
  }

  private async createPaymentRecord(data: {
    landlordId: string;
    amount: number;
    provider: PaymentProvider;
    providerReference: string;
    clientReference: string;
    payerPhone: string;
    payerName?: string;
    liabilityIds?: string[];
    metadata?: PaymentMetadata;
  }): Promise<PaymentRecord | null> {
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        landlord_id: data.landlordId,
        amount: data.amount,
        currency: DEFAULT_CURRENCY,
        provider: data.provider,
        provider_reference: data.providerReference,
        status: 'pending',
        initiated_at: new Date().toISOString(),
        metadata: {
          client_reference: data.clientReference,
          payer_phone: data.payerPhone,
          payer_name: data.payerName,
          liability_ids: data.liabilityIds,
          ...data.metadata,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('[PaymentService] Failed to create payment record:', error);
      return null;
    }

    return payment;
  }

  private async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: Partial<PaymentMetadata>
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (metadata) {
      // Merge with existing metadata
      const { data: existing } = await supabase
        .from('payments')
        .select('metadata')
        .eq('id', paymentId)
        .single();

      updateData.metadata = {
        ...(existing?.metadata || {}),
        ...metadata,
      };

      // Update provider_transaction_id if provided
      if (metadata.wave_transaction_id) {
        updateData.provider_transaction_id = metadata.wave_transaction_id;
      }
      if (metadata.orange_txn_id) {
        updateData.provider_transaction_id = metadata.orange_txn_id;
      }
    }

    await supabase.from('payments').update(updateData).eq('id', paymentId);

    console.log('[PaymentService] Payment status updated:', { paymentId, status });
  }

  private async createRefundRecord(data: {
    paymentId: string;
    amount: number;
    reason?: string;
    providerReference?: string;
    status: RefundStatus;
  }): Promise<{ id: string } | null> {
    const { data: refund, error } = await supabase
      .from('refunds')
      .insert({
        payment_id: data.paymentId,
        amount: data.amount,
        reason: data.reason,
        provider_reference: data.providerReference,
        status: data.status,
        initiated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[PaymentService] Failed to create refund record:', error);
      return null;
    }

    return refund;
  }

  private async findPaymentById(paymentId: string): Promise<PaymentRecord | null> {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    return data;
  }

  private async findPaymentByReference(reference: string): Promise<PaymentRecord | null> {
    // Try to find by payment ID first
    let { data } = await supabase
      .from('payments')
      .select('*')
      .eq('id', reference)
      .single();

    if (data) return data;

    // Try provider reference
    ({ data } = await supabase
      .from('payments')
      .select('*')
      .eq('provider_reference', reference)
      .single());

    if (data) return data;

    // Try client reference in metadata
    ({ data } = await supabase
      .from('payments')
      .select('*')
      .contains('metadata', { client_reference: reference })
      .single());

    return data;
  }

  private async findPaymentByProviderReference(
    providerReference: string,
    provider: PaymentProvider
  ): Promise<PaymentRecord | null> {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('provider', provider)
      .eq('provider_reference', providerReference)
      .single();

    return data;
  }

  private async findPaymentByClientReference(clientReference: string): Promise<PaymentRecord | null> {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .contains('metadata', { client_reference: clientReference })
      .single();

    return data;
  }

  private async fetchLandlordData(landlordId: string): Promise<{
    full_name: string;
    business_name?: string;
    ninea?: string;
    address?: string;
  } | null> {
    const { data } = await supabase
      .from('landlords')
      .select('full_name, business_name, ninea, address')
      .eq('id', landlordId)
      .single();

    return data;
  }

  private async fetchLiabilityData(liabilityIds: string[]): Promise<{
    period_start: string;
    period_end: string;
    guest_nights: number;
  } | null> {
    if (liabilityIds.length === 0) return null;

    const { data } = await supabase
      .from('tax_liabilities')
      .select('period_start, period_end, guest_nights')
      .in('id', liabilityIds);

    if (!data || data.length === 0) return null;

    // Aggregate data from multiple liabilities
    return {
      period_start: data[0].period_start,
      period_end: data[data.length - 1].period_end,
      guest_nights: data.reduce((sum, l) => sum + (l.guest_nights || 0), 0),
    };
  }

  private async fetchPropertyData(landlordId: string): Promise<{
    id: string;
    name: string;
    license_number?: string;
    address: string;
    city: string;
    region: string;
  } | null> {
    const { data } = await supabase
      .from('properties')
      .select('id, name, license_number, address, city, region')
      .eq('landlord_id', landlordId)
      .limit(1)
      .single();

    return data;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let paymentServiceInstance: PaymentService | null = null;

/**
 * Get the PaymentService singleton instance
 */
export function getPaymentService(): PaymentService {
  if (!paymentServiceInstance) {
    paymentServiceInstance = new PaymentService();
  }
  return paymentServiceInstance;
}

/**
 * Create a new PaymentService with custom configuration
 */
export function createPaymentService(retryConfig?: Partial<RetryConfig>): PaymentService {
  return new PaymentService(retryConfig);
}

// ============================================
// EXPORTS
// ============================================

export default getPaymentService;
