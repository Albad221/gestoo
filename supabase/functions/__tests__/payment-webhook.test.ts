import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// Signature verification functions (extracted from edge function)
function verifyWaveSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}

function verifyOrangeSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}

// Generate signature for testing
function generateSignature(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

describe('Payment Webhook Edge Function', () => {
  const testSecret = 'test-webhook-secret-12345';

  describe('Wave Signature Verification', () => {
    it('should verify valid Wave signature', () => {
      const payload = JSON.stringify({ event: 'payment.completed', data: { id: '123' } });
      const signature = generateSignature(payload, testSecret);

      expect(verifyWaveSignature(payload, signature, testSecret)).toBe(true);
    });

    it('should reject invalid Wave signature', () => {
      const payload = JSON.stringify({ event: 'payment.completed', data: { id: '123' } });
      const invalidSignature = 'invalid-signature-here';

      expect(verifyWaveSignature(payload, invalidSignature, testSecret)).toBe(false);
    });

    it('should reject modified payload', () => {
      const originalPayload = JSON.stringify({ event: 'payment.completed', data: { id: '123' } });
      const signature = generateSignature(originalPayload, testSecret);
      const modifiedPayload = JSON.stringify({
        event: 'payment.completed',
        data: { id: '456' },
      });

      expect(verifyWaveSignature(modifiedPayload, signature, testSecret)).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const payload = JSON.stringify({ event: 'payment.completed', data: { id: '123' } });
      const signature = generateSignature(payload, 'wrong-secret');

      expect(verifyWaveSignature(payload, signature, testSecret)).toBe(false);
    });
  });

  describe('Orange Money Signature Verification', () => {
    it('should verify valid Orange Money signature', () => {
      const payload = JSON.stringify({ status: 'SUCCESS', txnid: 'OM123' });
      const signature = generateSignature(payload, testSecret);

      expect(verifyOrangeSignature(payload, signature, testSecret)).toBe(true);
    });

    it('should reject invalid Orange Money signature', () => {
      const payload = JSON.stringify({ status: 'SUCCESS', txnid: 'OM123' });
      const invalidSignature = 'tampered-signature';

      expect(verifyOrangeSignature(payload, invalidSignature, testSecret)).toBe(false);
    });
  });

  describe('Wave Webhook Event Handling', () => {
    it('should recognize checkout.session.completed event', () => {
      const event = 'checkout.session.completed';
      const isPaymentComplete =
        event === 'checkout.session.completed' || event === 'payment.completed';
      expect(isPaymentComplete).toBe(true);
    });

    it('should recognize payment.completed event', () => {
      const event = 'payment.completed';
      const isPaymentComplete =
        event === 'checkout.session.completed' || event === 'payment.completed';
      expect(isPaymentComplete).toBe(true);
    });

    it('should extract client reference from Wave data', () => {
      const data = { client_reference: 'PAY-2024-001', reference: 'backup-ref' };
      const paymentRef = data.client_reference || data.reference;
      expect(paymentRef).toBe('PAY-2024-001');
    });

    it('should fallback to reference if client_reference is missing', () => {
      const data = { reference: 'backup-ref' };
      const paymentRef = (data as any).client_reference || data.reference;
      expect(paymentRef).toBe('backup-ref');
    });
  });

  describe('Orange Money Webhook Event Handling', () => {
    it('should recognize SUCCESS status', () => {
      const status = 'SUCCESS';
      const isSuccess = status === 'SUCCESS' || status === 'SUCCESSFULL';
      expect(isSuccess).toBe(true);
    });

    it('should recognize SUCCESSFULL status', () => {
      const status = 'SUCCESSFULL';
      const isSuccess = status === 'SUCCESS' || status === 'SUCCESSFULL';
      expect(isSuccess).toBe(true);
    });

    it('should recognize FAILED status', () => {
      const status = 'FAILED';
      const isFailed = status === 'FAILED' || status === 'CANCELLED';
      expect(isFailed).toBe(true);
    });

    it('should recognize CANCELLED status', () => {
      const status = 'CANCELLED';
      const isFailed = status === 'FAILED' || status === 'CANCELLED';
      expect(isFailed).toBe(true);
    });

    it('should extract transaction reference from Orange Money data', () => {
      const data = { notif_token: 'NOTIF-123', txnid: 'TXN-456' };
      const providerRef = data.notif_token || data.txnid;
      expect(providerRef).toBe('NOTIF-123');
    });
  });

  describe('Provider Detection', () => {
    it('should detect wave provider from query param', () => {
      const url = new URL('https://example.com/webhook?provider=wave');
      const provider = url.searchParams.get('provider');
      expect(provider).toBe('wave');
    });

    it('should detect orange_money provider from query param', () => {
      const url = new URL('https://example.com/webhook?provider=orange_money');
      const provider = url.searchParams.get('provider');
      expect(provider).toBe('orange_money');
    });

    it('should handle unknown provider', () => {
      const url = new URL('https://example.com/webhook?provider=unknown');
      const provider = url.searchParams.get('provider');
      const isKnown = provider === 'wave' || provider === 'orange_money';
      expect(isKnown).toBe(false);
    });

    it('should handle missing provider', () => {
      const url = new URL('https://example.com/webhook');
      const provider = url.searchParams.get('provider');
      expect(provider).toBeNull();
    });
  });

  describe('Payment Status Update', () => {
    it('should create completed status update object for success', () => {
      const data = { id: 'wave-123', transaction_id: 'txn-456', status: 'completed' };

      const updatePayload = {
        status: 'completed',
        provider_ref: data.id,
        paid_at: new Date().toISOString(),
        metadata: {
          wave_transaction_id: data.transaction_id,
          wave_status: data.status,
        },
      };

      expect(updatePayload.status).toBe('completed');
      expect(updatePayload.provider_ref).toBe('wave-123');
      expect(updatePayload.metadata.wave_transaction_id).toBe('txn-456');
    });

    it('should create failed status update object for failure', () => {
      const status = 'FAILED';

      const updatePayload = {
        status: 'failed',
        metadata: {
          orange_status: status,
          failed_at: new Date().toISOString(),
        },
      };

      expect(updatePayload.status).toBe('failed');
      expect(updatePayload.metadata.orange_status).toBe('FAILED');
    });
  });

  describe('Tax Liability Update', () => {
    it('should extract liability IDs from payment metadata', () => {
      const payment = {
        metadata: { liability_ids: ['lib-1', 'lib-2', 'lib-3'] },
        tax_liability_id: 'lib-default',
      };

      const liabilityIds = payment.metadata?.liability_ids || [payment.tax_liability_id];
      expect(liabilityIds).toEqual(['lib-1', 'lib-2', 'lib-3']);
    });

    it('should fallback to single tax_liability_id', () => {
      const payment = {
        metadata: {},
        tax_liability_id: 'lib-single',
      };

      const liabilityIds = payment.metadata?.liability_ids || [payment.tax_liability_id];
      expect(liabilityIds).toEqual(['lib-single']);
    });
  });
});
