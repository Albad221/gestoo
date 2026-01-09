/**
 * Payment Flow Handler for WhatsApp Chatbot
 *
 * This module handles the complete payment flow for TPT (Taxe de Promotion Touristique)
 * payments through the WhatsApp chatbot interface, using the unified PaymentService.
 */

import type { WhatsAppMessage, ChatbotSession, PaymentMethod } from '@gestoo/types';
import { updateSession } from '../lib/session.js';
import { sendMessage, sendInteractiveButtons } from '../lib/whatsapp.js';
import { supabase } from '../lib/supabase.js';
import {
  getPaymentService,
  type InitiatePaymentOptions,
  type PaymentProvider,
} from '../lib/payment-service.js';
import { getUSSDInstructions } from '../lib/orange-money.js';
import {
  formatAmountFCFA,
  getProviderDisplayName,
  getPaymentErrorMessage,
} from '@gestoo/shared-types/payments';

// ============================================
// PAYMENT FLOW HANDLER
// ============================================

export async function handlePayment(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  switch (session.state) {
    case 'PAY_TPT_VIEW':
      await handleViewBalance(phone, session);
      break;

    case 'PAY_TPT_METHOD':
      await handleSelectMethod(phone, message, session);
      break;

    case 'PAY_TPT_CONFIRM':
      await handlePaymentConfirm(phone, message, session);
      break;

    case 'PAY_TPT_PENDING':
      await handlePaymentPending(phone, message, session);
      break;
  }
}

// ============================================
// VIEW BALANCE
// ============================================

async function handleViewBalance(phone: string, session: ChatbotSession): Promise<void> {
  // Get outstanding tax liabilities
  const { data: liabilities, error } = await supabase
    .from('tax_liabilities')
    .select('id, amount, paid_amount, created_at, period_start, period_end')
    .eq('landlord_id', session.landlord_id)
    .eq('status', 'pending');

  if (error) {
    console.error('Error fetching liabilities:', error);
    await sendMessage(phone, "Une erreur s'est produite. Veuillez reessayer.");
    await updateSession(phone, { state: 'IDLE' });
    return;
  }

  if (!liabilities || liabilities.length === 0) {
    await sendMessage(
      phone,
      "Vous n'avez pas de TPT en attente de paiement.

Tapez 'menu' pour continuer."
    );
    await updateSession(phone, { state: 'IDLE' });
    return;
  }

  const totalDue = liabilities.reduce((sum, l) => sum + (l.amount - l.paid_amount), 0);
  const liabilityIds = liabilities.map((l) => l.id);

  // Get user's preferred payment method
  const paymentService = getPaymentService();
  const preferredProvider = await paymentService.getPreferredProvider(session.landlord_id!);

  await updateSession(phone, {
    state: 'PAY_TPT_METHOD',
    data: {
      ...session.data,
      total_due: totalDue,
      liability_ids: liabilityIds,
      preferred_provider: preferredProvider,
    },
  });

  await sendMessage(
    phone,
    `Solde TPT a payer

Nombre de declarations : ${liabilities.length}
Montant total : ${formatAmountFCFA(totalDue)}

Comment souhaitez-vous payer ?`
  );

  await sendInteractiveButtons(phone, 'Mode de paiement', [
    { id: 'wave', title: 'Wave' },
    { id: 'orange_money', title: 'Orange Money' },
    { id: 'cancel', title: 'Annuler' },
  ]);
}

// ============================================
// SELECT PAYMENT METHOD
// ============================================

async function handleSelectMethod(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  if (message.type !== 'interactive' || !message.interactive?.button_reply) {
    await sendMessage(phone, 'Veuillez selectionner un mode de paiement.');
    return;
  }

  const reply = message.interactive.button_reply.id;

  if (reply === 'cancel') {
    await updateSession(phone, { state: 'IDLE', data: {} });
    await sendMessage(phone, "Paiement annule. Tapez 'menu' pour continuer.");
    return;
  }

  const paymentMethods: Record<string, PaymentProvider> = {
    wave: 'wave',
    orange_money: 'orange_money',
  };

  const method = paymentMethods[reply];

  if (!method) {
    await sendMessage(phone, 'Mode de paiement invalide. Veuillez reessayer.');
    return;
  }

  const totalDue = session.data.total_due as number;

  await updateSession(phone, {
    state: 'PAY_TPT_CONFIRM',
    data: { ...session.data, payment_method: method },
  });

  // Save preferred payment method for future use
  const paymentService = getPaymentService();
  await paymentService.setPreferredProvider(session.landlord_id!, method);

  await sendMessage(
    phone,
    `Paiement ${getProviderDisplayName(method)}

Montant : ${formatAmountFCFA(totalDue)}
Numero : ${phone}

Confirmez-vous ce paiement ?`
  );

  await sendInteractiveButtons(phone, 'Confirmation', [
    { id: 'confirm_payment', title: 'Payer maintenant' },
    { id: 'cancel', title: 'Annuler' },
  ]);
}

// ============================================
// CONFIRM PAYMENT
// ============================================

async function handlePaymentConfirm(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  if (message.type !== 'interactive' || !message.interactive?.button_reply) {
    await sendMessage(phone, 'Veuillez confirmer ou annuler le paiement.');
    return;
  }

  const reply = message.interactive.button_reply.id;

  if (reply === 'cancel') {
    await updateSession(phone, { state: 'IDLE', data: {} });
    await sendMessage(phone, "Paiement annule. Tapez 'menu' pour continuer.");
    return;
  }

  if (reply !== 'confirm_payment') {
    await sendMessage(phone, 'Option non reconnue. Veuillez confirmer ou annuler.');
    return;
  }

  const method = session.data.payment_method as PaymentProvider;
  const totalDue = session.data.total_due as number;
  const liabilityIds = session.data.liability_ids as string[];

  await sendMessage(phone, 'Initialisation du paiement...');

  // Use the unified payment service
  const paymentService = getPaymentService();

  const paymentOptions: InitiatePaymentOptions = {
    provider: method,
    amount: totalDue,
    landlordId: session.landlord_id!,
    liabilityIds,
    payerPhone: phone,
    metadata: {
      channel: 'whatsapp',
      session_id: session.id,
    },
  };

  // Initiate payment with retry logic
  const result = await paymentService.initiatePaymentWithRetry(paymentOptions);

  if (!result.success || !result.paymentId) {
    const errorMessage = result.error
      ? getPaymentErrorMessage(result.error.code)
      : "Une erreur s'est produite lors de l'initialisation du paiement.";

    await sendMessage(
      phone,
      `${errorMessage}

Veuillez reessayer ou choisir un autre mode de paiement.`
    );
    await updateSession(phone, { state: 'PAY_TPT_METHOD' });
    return;
  }

  // Store payment info in session for status checking
  await updateSession(phone, {
    state: 'PAY_TPT_PENDING',
    data: {
      ...session.data,
      payment_id: result.paymentId,
      provider_reference: result.providerReference,
      payment_url: result.paymentUrl,
      expires_at: result.expiresAt,
    },
  });

  // Send provider-specific instructions
  if (method === 'orange_money') {
    await sendOrangeMoneyInstructions(phone, totalDue, result);
  } else if (method === 'wave') {
    await sendWaveInstructions(phone, totalDue, result);
  }

  console.log('[Payment] Payment initiated:', {
    paymentId: result.paymentId,
    provider: method,
    amount: totalDue,
    landlordId: session.landlord_id,
  });
}

// ============================================
// PENDING PAYMENT STATUS
// ============================================

async function handlePaymentPending(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  const messageText = message.text?.body?.toLowerCase() || '';

  // Handle user commands while waiting for payment
  if (messageText === 'status' || messageText === 'statut') {
    await checkPaymentStatus(phone, session);
    return;
  }

  if (messageText === 'cancel' || messageText === 'annuler') {
    await cancelPendingPayment(phone, session);
    return;
  }

  if (messageText === 'menu') {
    // Check if payment is still pending
    const paymentId = session.data.payment_id as string;
    const paymentService = getPaymentService();
    const method = session.data.payment_method as PaymentProvider;

    const statusResult = await paymentService.checkStatus(method, paymentId);

    if (statusResult.status === 'completed') {
      await sendMessage(
        phone,
        `Votre paiement a ete confirme!

Vous allez recevoir votre recu par SMS.

Tapez 'menu' pour continuer.`
      );
      await updateSession(phone, { state: 'IDLE', data: {} });
      return;
    }

    await sendMessage(
      phone,
      `Vous avez un paiement en attente.

Tapez 'status' pour verifier le statut
Tapez 'annuler' pour annuler le paiement`
    );
    return;
  }

  // Default message for pending state
  await sendMessage(
    phone,
    `Votre paiement est en attente de confirmation.

Tapez 'status' pour verifier le statut
Tapez 'annuler' pour annuler le paiement`
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function sendOrangeMoneyInstructions(
  phone: string,
  amount: number,
  result: { paymentId?: string; providerReference?: string; paymentUrl?: string }
): Promise<void> {
  const ussdInstructions = getUSSDInstructions(amount, 'fr');

  await sendMessage(
    phone,
    `*Paiement Orange Money*

Montant : ${formatAmountFCFA(amount)}
Reference : ${result.providerReference?.substring(0, 12) || 'N/A'}

${ussdInstructions}

Vous avez 15 minutes pour effectuer ce paiement.

Vous recevrez une confirmation une fois le paiement effectue.`
  );

  // Send payment URL if available
  if (result.paymentUrl) {
    await sendMessage(
      phone,
      `Vous pouvez aussi payer en cliquant sur ce lien:
${result.paymentUrl}`
    );
  }
}

async function sendWaveInstructions(
  phone: string,
  amount: number,
  result: { paymentId?: string; providerReference?: string; paymentUrl?: string }
): Promise<void> {
  // Wave has a dedicated payment URL
  if (result.paymentUrl) {
    await sendMessage(
      phone,
      `*Paiement Wave*

Montant : ${formatAmountFCFA(amount)}

Cliquez sur le lien ci-dessous pour payer:
${result.paymentUrl}

Ou ouvrez votre application Wave pour verifier la demande de paiement.`
    );
  } else {
    await sendMessage(
      phone,
      `*Paiement Wave*

Montant : ${formatAmountFCFA(amount)}
Numero : ${phone}

Une demande de paiement Wave a ete envoyee a votre telephone.

1. Ouvrez votre application Wave
2. Verifiez la demande de paiement
3. Entrez votre code PIN pour confirmer

Vous recevrez une confirmation une fois le paiement effectue.`
    );
  }
}

async function checkPaymentStatus(phone: string, session: ChatbotSession): Promise<void> {
  const paymentId = session.data.payment_id as string;
  const method = session.data.payment_method as PaymentProvider;

  if (!paymentId) {
    await sendMessage(phone, "Aucun paiement en cours. Tapez 'menu' pour continuer.");
    await updateSession(phone, { state: 'IDLE', data: {} });
    return;
  }

  await sendMessage(phone, 'Verification du statut...');

  const paymentService = getPaymentService();
  const statusResult = await paymentService.checkStatus(method, paymentId);

  switch (statusResult.status) {
    case 'completed':
      await sendMessage(
        phone,
        `Paiement confirme!

Montant : ${formatAmountFCFA(statusResult.amount)}
Reference : ${statusResult.transactionId || paymentId.substring(0, 8)}

Vous allez recevoir votre recu par SMS.

Tapez 'menu' pour continuer.`
      );

      // Update tax liabilities as paid
      await markLiabilitiesAsPaid(session);
      await updateSession(phone, { state: 'IDLE', data: {} });
      break;

    case 'failed':
      await sendMessage(
        phone,
        `Le paiement a echoue.

Raison : ${statusResult.error?.message || 'Erreur inconnue'}

Veuillez reessayer. Tapez 'menu' pour continuer.`
      );
      await updateSession(phone, { state: 'IDLE', data: {} });
      break;

    case 'expired':
      await sendMessage(
        phone,
        `La session de paiement a expire.

Veuillez reinitier le paiement. Tapez 'menu' pour continuer.`
      );
      await updateSession(phone, { state: 'IDLE', data: {} });
      break;

    case 'cancelled':
      await sendMessage(phone, `Le paiement a ete annule.

Tapez 'menu' pour continuer.`);
      await updateSession(phone, { state: 'IDLE', data: {} });
      break;

    default:
      await sendMessage(
        phone,
        `Paiement en attente.

Statut : ${statusResult.providerStatus || 'En cours'}

Veuillez finaliser votre paiement via ${getProviderDisplayName(method)}.`
      );
      break;
  }
}

async function cancelPendingPayment(phone: string, session: ChatbotSession): Promise<void> {
  const paymentId = session.data.payment_id as string;

  if (!paymentId) {
    await sendMessage(phone, "Aucun paiement en cours. Tapez 'menu' pour continuer.");
    await updateSession(phone, { state: 'IDLE', data: {} });
    return;
  }

  // Update payment status to cancelled
  await supabase.from('payments').update({ status: 'cancelled' }).eq('id', paymentId);

  await sendMessage(
    phone,
    `Paiement annule.

Vous pouvez reinitier un paiement a tout moment. Tapez 'menu' pour continuer.`
  );

  await updateSession(phone, { state: 'IDLE', data: {} });
}

async function markLiabilitiesAsPaid(session: ChatbotSession): Promise<void> {
  const liabilityIds = session.data.liability_ids as string[];
  const paymentId = session.data.payment_id as string;

  if (!liabilityIds || liabilityIds.length === 0) return;

  // Update tax liabilities status
  await supabase
    .from('tax_liabilities')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_id: paymentId,
    })
    .in('id', liabilityIds);

  console.log('[Payment] Liabilities marked as paid:', { liabilityIds, paymentId });
}

// ============================================
// WEBHOOK NOTIFICATION HANDLER
// ============================================

/**
 * Handle payment completion notification from webhook
 * This is called by the webhook handler when a payment is confirmed
 */
export async function handlePaymentCompletionNotification(
  paymentId: string,
  landlordId: string
): Promise<void> {
  // Find the session for this landlord
  const { data: session } = await supabase
    .from('chatbot_sessions')
    .select('*')
    .eq('landlord_id', landlordId)
    .eq('state', 'PAY_TPT_PENDING')
    .single();

  if (!session) {
    console.log('[Payment] No pending session found for notification:', { paymentId, landlordId });
    return;
  }

  // Check if this is the payment we're waiting for
  if (session.data?.payment_id !== paymentId) {
    console.log('[Payment] Payment ID mismatch:', {
      expected: session.data?.payment_id,
      received: paymentId,
    });
    return;
  }

  // Get the phone number from the session
  const phone = session.phone;

  // Send confirmation message
  await sendMessage(
    phone,
    `Paiement confirme!

Votre paiement TPT a ete recu avec succes. Vous allez recevoir votre recu par SMS.

Merci pour votre contribution au developpement du tourisme senegalais!

Tapez 'menu' pour continuer.`
  );

  // Mark liabilities as paid
  await markLiabilitiesAsPaid(session);

  // Update session state
  await updateSession(phone, { state: 'IDLE', data: {} });

  console.log('[Payment] Completion notification handled:', { paymentId, phone });
}

// ============================================
// QUICK PAYMENT INITIATION
// ============================================

/**
 * Initiate a quick payment using user's preferred provider
 * Used when user wants to pay without going through the full flow
 */
export async function initiateQuickPayment(
  phone: string,
  landlordId: string,
  amount: number,
  liabilityIds: string[]
): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
  const paymentService = getPaymentService();

  const result = await paymentService.initiatePaymentWithPreferredProvider({
    amount,
    landlordId,
    liabilityIds,
    payerPhone: phone,
    metadata: {
      channel: 'whatsapp',
      quick_payment: true,
    },
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message || 'Payment initiation failed',
    };
  }

  return {
    success: true,
    paymentUrl: result.paymentUrl,
  };
}
