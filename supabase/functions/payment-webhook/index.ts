import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, wave-signature, x-orange-signature',
};

// Verify Wave webhook signature
function verifyWaveSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}

// Verify Orange Money webhook signature
// Uses HMAC-SHA256 for signature verification
// Includes constant-time comparison to prevent timing attacks
function verifyOrangeSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const provider = url.searchParams.get('provider'); // 'wave' or 'orange_money'

    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    console.log(`Received ${provider} webhook:`, body);

    // Verify webhook signature based on provider
    if (provider === 'wave') {
      const waveSignature = req.headers.get('wave-signature');
      const waveSecret = Deno.env.get('WAVE_WEBHOOK_SECRET');

      if (waveSignature && waveSecret) {
        if (!verifyWaveSignature(rawBody, waveSignature, waveSecret)) {
          console.error('Invalid Wave webhook signature');
          return new Response(
            JSON.stringify({ error: 'Invalid signature' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Process Wave webhook
      const { event, data } = body;

      if (event === 'checkout.session.completed' || event === 'payment.completed') {
        const paymentRef = data.client_reference || data.reference;

        // Find payment by reference
        const { data: payment, error: findError } = await supabaseClient
          .from('payments')
          .select('*')
          .eq('provider_ref', paymentRef)
          .single();

        if (findError || !payment) {
          // Try to find by metadata
          const { data: paymentByMeta } = await supabaseClient
            .from('payments')
            .select('*')
            .contains('metadata', { wave_checkout_id: data.id })
            .single();

          if (!paymentByMeta) {
            console.error('Payment not found for Wave reference:', paymentRef);
            return new Response(
              JSON.stringify({ error: 'Payment not found' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const targetPayment = payment;

        // Update payment status
        const { error: updateError } = await supabaseClient
          .from('payments')
          .update({
            status: 'completed',
            provider_ref: data.id,
            paid_at: new Date().toISOString(),
            metadata: {
              ...targetPayment.metadata,
              wave_transaction_id: data.transaction_id,
              wave_status: data.status,
            },
          })
          .eq('id', targetPayment.id);

        if (updateError) {
          console.error('Error updating payment:', updateError);
          throw updateError;
        }

        // Update tax liability status
        const liabilityIds = targetPayment.metadata?.liability_ids || [targetPayment.tax_liability_id];
        await supabaseClient
          .from('tax_liabilities')
          .update({ status: 'paid' })
          .in('id', liabilityIds);

        console.log('Wave payment completed:', targetPayment.id);
      }

    } else if (provider === 'orange_money') {
      const orangeSignature = req.headers.get('x-orange-signature');
      const orangeSecret = Deno.env.get('ORANGE_MONEY_WEBHOOK_SECRET');

      // Verify signature in production (skip if secret not configured for dev)
      if (orangeSignature && orangeSecret) {
        if (!verifyOrangeSignature(rawBody, orangeSignature, orangeSecret)) {
          console.error('Invalid Orange Money webhook signature');
          return new Response(
            JSON.stringify({ error: 'Invalid signature' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('Orange Money webhook signature verified');
      }

      // Process Orange Money webhook
      // Orange Money sends: status, txnid, notif_token, order_id, amount, currency
      const { status, txnid, notif_token, order_id, amount } = body;

      console.log('Processing Orange Money webhook:', { status, txnid, order_id, amount });

      // Helper function to find payment by various identifiers
      async function findOrangeMoneyPayment() {
        // Try by provider_ref (pay_token)
        let { data: payment } = await supabaseClient
          .from('payments')
          .select('*')
          .eq('provider_ref', notif_token)
          .single();

        if (payment) return payment;

        // Try by order_id in metadata
        if (order_id) {
          const { data: paymentByOrderId } = await supabaseClient
            .from('payments')
            .select('*')
            .contains('metadata', { orange_order_id: order_id })
            .single();

          if (paymentByOrderId) return paymentByOrderId;
        }

        // Try by pay_token in metadata
        if (notif_token) {
          const { data: paymentByPayToken } = await supabaseClient
            .from('payments')
            .select('*')
            .contains('metadata', { orange_pay_token: notif_token })
            .single();

          if (paymentByPayToken) return paymentByPayToken;
        }

        // Try by notif_token in metadata
        if (notif_token) {
          const { data: paymentByNotifToken } = await supabaseClient
            .from('payments')
            .select('*')
            .contains('metadata', { orange_notif_token: notif_token })
            .single();

          if (paymentByNotifToken) return paymentByNotifToken;
        }

        return null;
      }

      // Orange Money status codes: INITIATED, PENDING, SUCCESS, FAILED, EXPIRED, CANCELLED
      if (status === 'SUCCESS' || status === 'SUCCESSFULL') {
        const targetPayment = await findOrangeMoneyPayment();

        if (!targetPayment) {
          console.error('Payment not found for Orange Money webhook:', { txnid, notif_token, order_id });
          return new Response(
            JSON.stringify({ error: 'Payment not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update payment status
        const { error: updateError } = await supabaseClient
          .from('payments')
          .update({
            status: 'completed',
            provider_ref: txnid || notif_token,
            paid_at: new Date().toISOString(),
            metadata: {
              ...targetPayment.metadata,
              orange_txn_id: txnid,
              orange_status: status,
              webhook_received_at: new Date().toISOString(),
            },
          })
          .eq('id', targetPayment.id);

        if (updateError) {
          console.error('Error updating payment:', updateError);
          throw updateError;
        }

        // Update tax liability status
        const liabilityIds = targetPayment.metadata?.liability_ids || [targetPayment.tax_liability_id];
        if (liabilityIds && liabilityIds.length > 0) {
          await supabaseClient
            .from('tax_liabilities')
            .update({ status: 'paid', paid_amount: amount || targetPayment.amount })
            .in('id', liabilityIds);
        }

        console.log('Orange Money payment completed:', {
          paymentId: targetPayment.id,
          txnid,
          amount,
        });

      } else if (status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED') {
        const targetPayment = await findOrangeMoneyPayment();

        if (targetPayment) {
          const newStatus = status === 'EXPIRED' ? 'failed' : 'failed';
          await supabaseClient
            .from('payments')
            .update({
              status: newStatus,
              metadata: {
                ...targetPayment.metadata,
                orange_status: status,
                orange_txn_id: txnid,
                failed_at: new Date().toISOString(),
                failure_reason: status === 'EXPIRED' ? 'Payment request expired' :
                               status === 'CANCELLED' ? 'Payment cancelled by user' : 'Payment failed',
              },
            })
            .eq('id', targetPayment.id);

          console.log('Orange Money payment failed/cancelled/expired:', {
            paymentId: targetPayment.id,
            status,
          });
        }

      } else if (status === 'PENDING' || status === 'INITIATED') {
        // Payment is in progress, just log it
        console.log('Orange Money payment pending:', { txnid, notif_token, status });
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Unknown provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
