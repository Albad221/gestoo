import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate unique receipt number
function generateReceiptNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REC-${year}-${timestamp}${random}`;
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-SN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}

// Format date
function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Generate HTML receipt
function generateReceiptHTML(data: {
  receiptNumber: string;
  payment: any;
  landlord: any;
  liability: any;
  property: any;
  stay: any;
  guest: any;
}): string {
  const { receiptNumber, payment, landlord, liability, property, stay, guest } = data;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recu TPT - ${receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f3f4f6;
      padding: 20px;
    }
    .receipt {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #00695c 0%, #00897b 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 { font-size: 24px; margin-bottom: 5px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .logo { font-size: 40px; margin-bottom: 15px; }
    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 8px 16px;
      border-radius: 20px;
      margin-top: 15px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .content { padding: 30px; }
    .receipt-number {
      text-align: center;
      padding: 15px;
      background: #f0fdf4;
      border-radius: 8px;
      margin-bottom: 25px;
    }
    .receipt-number span {
      font-size: 12px;
      color: #6b7280;
      display: block;
      margin-bottom: 5px;
    }
    .receipt-number strong {
      font-size: 20px;
      color: #15803d;
      font-family: monospace;
    }
    .section { margin-bottom: 25px; }
    .section-title {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
    }
    .row .label { color: #6b7280; }
    .row .value { font-weight: 500; color: #111827; }
    .total {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .total .row {
      font-size: 18px;
      padding: 0;
    }
    .total .value {
      color: #00695c;
      font-size: 24px;
      font-weight: 700;
    }
    .footer {
      padding: 20px 30px;
      background: #f9fafb;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .footer p { margin-bottom: 5px; }
    .qr-placeholder {
      width: 100px;
      height: 100px;
      background: #e5e7eb;
      margin: 15px auto;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #9ca3af;
    }
    .stamp {
      position: relative;
      display: inline-block;
      margin-top: 15px;
    }
    .stamp-circle {
      border: 3px solid #00695c;
      border-radius: 50%;
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(-15deg);
    }
    .stamp-text {
      color: #00695c;
      font-weight: bold;
      font-size: 11px;
      text-align: center;
    }
    @media print {
      body { background: white; padding: 0; }
      .receipt { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="logo">🏛️</div>
      <h1>Gestoo</h1>
      <p>Ministere du Tourisme et des Loisirs</p>
      <p>Republique du Senegal</p>
      <div class="badge">Recu Officiel TPT</div>
    </div>

    <div class="content">
      <div class="receipt-number">
        <span>Numero de recu</span>
        <strong>${receiptNumber}</strong>
      </div>

      <div class="section">
        <div class="section-title">Informations de paiement</div>
        <div class="row">
          <span class="label">Date de paiement</span>
          <span class="value">${formatDate(payment.paid_at)}</span>
        </div>
        <div class="row">
          <span class="label">Mode de paiement</span>
          <span class="value">${payment.provider === 'wave' ? 'Wave' : payment.provider === 'orange_money' ? 'Orange Money' : payment.provider}</span>
        </div>
        <div class="row">
          <span class="label">Reference</span>
          <span class="value">${payment.provider_ref || payment.id.substring(0, 8).toUpperCase()}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Proprietaire</div>
        <div class="row">
          <span class="label">Nom</span>
          <span class="value">${landlord.full_name}</span>
        </div>
        <div class="row">
          <span class="label">Telephone</span>
          <span class="value">+221 ${landlord.phone}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Propriete</div>
        <div class="row">
          <span class="label">Nom</span>
          <span class="value">${property.name}</span>
        </div>
        <div class="row">
          <span class="label">Licence</span>
          <span class="value">${property.license_number || 'N/A'}</span>
        </div>
        <div class="row">
          <span class="label">Adresse</span>
          <span class="value">${property.address}, ${property.city}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Details du sejour</div>
        <div class="row">
          <span class="label">Locataire</span>
          <span class="value">${guest.first_name} ${guest.last_name}</span>
        </div>
        <div class="row">
          <span class="label">Nationalite</span>
          <span class="value">${guest.nationality}</span>
        </div>
        <div class="row">
          <span class="label">Periode</span>
          <span class="value">${new Date(stay.check_in).toLocaleDateString('fr-FR')} - ${stay.check_out ? new Date(stay.check_out).toLocaleDateString('fr-FR') : 'N/A'}</span>
        </div>
        <div class="row">
          <span class="label">Nuits-personnes</span>
          <span class="value">${liability.guest_nights}</span>
        </div>
        <div class="row">
          <span class="label">Tarif par nuit</span>
          <span class="value">${formatCurrency(liability.rate_per_night)}</span>
        </div>
      </div>

      <div class="total">
        <div class="row">
          <span class="label">Taxe de Promotion Touristique (TPT)</span>
          <span class="value">${formatCurrency(payment.amount)}</span>
        </div>
      </div>

      <div style="text-align: center; margin-top: 25px;">
        <div class="stamp">
          <div class="stamp-circle">
            <div class="stamp-text">PAYE<br/>${new Date(payment.paid_at).toLocaleDateString('fr-FR')}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="qr-placeholder">QR Code</div>
      <p><strong>Ce recu est genere electroniquement et fait foi.</strong></p>
      <p>Verifiez l'authenticite sur gestoo.gouv.sn/verify/${receiptNumber}</p>
      <p style="margin-top: 10px;">Gestoo - Plateforme Nationale d'Hebergement</p>
      <p>© ${new Date().getFullYear()} Ministere du Tourisme et des Loisirs</p>
    </div>
  </div>
</body>
</html>
  `;
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

    const { payment_id } = await req.json();

    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: 'payment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get payment with related data
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payment.status !== 'completed') {
      return new Response(
        JSON.stringify({ error: 'Payment not completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if receipt already exists
    if (payment.receipt_url) {
      return new Response(
        JSON.stringify({
          receipt_number: payment.receipt_number,
          receipt_url: payment.receipt_url
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get landlord
    const { data: landlord } = await supabaseClient
      .from('landlords')
      .select('*')
      .eq('id', payment.landlord_id)
      .single();

    // Get tax liability with related data
    const { data: liability } = await supabaseClient
      .from('tax_liabilities')
      .select('*, stays(*, guests(*)), properties(*)')
      .eq('id', payment.tax_liability_id)
      .single();

    if (!landlord || !liability) {
      return new Response(
        JSON.stringify({ error: 'Related data not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate receipt number
    const receiptNumber = generateReceiptNumber();

    // Generate HTML receipt
    const receiptHTML = generateReceiptHTML({
      receiptNumber,
      payment,
      landlord,
      liability,
      property: liability.properties,
      stay: liability.stays,
      guest: liability.stays.guests,
    });

    // Store receipt HTML in storage
    const receiptFileName = `receipts/${receiptNumber}.html`;
    const { error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(receiptFileName, receiptHTML, {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading receipt:', uploadError);
      // Continue anyway, we'll return the HTML directly
    }

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from('documents')
      .getPublicUrl(receiptFileName);

    const receiptUrl = urlData?.publicUrl || null;

    // Update payment with receipt info
    await supabaseClient
      .from('payments')
      .update({
        receipt_number: receiptNumber,
        receipt_url: receiptUrl,
      })
      .eq('id', payment_id);

    return new Response(
      JSON.stringify({
        receipt_number: receiptNumber,
        receipt_url: receiptUrl,
        receipt_html: receiptHTML,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating receipt:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
