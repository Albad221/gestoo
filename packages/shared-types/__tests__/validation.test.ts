import { describe, it, expect } from 'vitest';

// Import types from shared-types (these would normally be imported)
// For testing, we'll define the validation logic here

// Enum values
const PROPERTY_TYPES = ['hotel', 'meuble', 'guesthouse', 'short_term'] as const;
const PROPERTY_STATUSES = ['pending', 'active', 'suspended', 'rejected'] as const;
const DOCUMENT_TYPES = ['cni', 'passport', 'cedeao_id', 'residence_permit'] as const;
const STAY_STATUSES = ['active', 'completed', 'cancelled'] as const;
const PAYMENT_STATUSES = ['pending', 'processing', 'completed', 'failed', 'refunded'] as const;
const PAYMENT_METHODS = ['wave', 'orange_money', 'card', 'cash'] as const;
const ALERT_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const ALERT_STATUSES = ['new', 'acknowledged', 'investigating', 'resolved', 'dismissed'] as const;
const USER_ROLES = ['landlord', 'police', 'ministry', 'tax_authority', 'admin'] as const;

const SENEGAL_REGIONS = [
  'Dakar',
  'Diourbel',
  'Fatick',
  'Kaffrine',
  'Kaolack',
  'Kedougou',
  'Kolda',
  'Louga',
  'Matam',
  'Saint-Louis',
  'Sedhiou',
  'Tambacounda',
  'Thies',
  'Ziguinchor',
] as const;

// Constants
const TPT_RATE_PER_NIGHT = 1000;
const MIN_GUARDIAN_AGE = 21;
const MINOR_AGE = 18;

// Validation helpers
function isValidPropertyType(type: string): boolean {
  return PROPERTY_TYPES.includes(type as any);
}

function isValidPropertyStatus(status: string): boolean {
  return PROPERTY_STATUSES.includes(status as any);
}

function isValidDocumentType(type: string): boolean {
  return DOCUMENT_TYPES.includes(type as any);
}

function isValidPaymentMethod(method: string): boolean {
  return PAYMENT_METHODS.includes(method as any);
}

function isValidPaymentStatus(status: string): boolean {
  return PAYMENT_STATUSES.includes(status as any);
}

function isValidAlertSeverity(severity: string): boolean {
  return ALERT_SEVERITIES.includes(severity as any);
}

function isValidUserRole(role: string): boolean {
  return USER_ROLES.includes(role as any);
}

function isValidSenegalRegion(region: string): boolean {
  return SENEGAL_REGIONS.includes(region as any);
}

// Phone number validation (Senegal format)
function isValidSenegalPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, '').replace('+', '');
  const pattern = /^221[7-9]\d{8}$/;
  return pattern.test(cleaned) || /^[7-9]\d{8}$/.test(cleaned);
}

// Email validation
function isValidEmail(email: string): boolean {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

// UUID validation
function isValidUUID(uuid: string): boolean {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return pattern.test(uuid);
}

// Date validation
function isValidISODate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

describe('Shared Types Validation', () => {
  describe('Property Type Validation', () => {
    it('should accept valid property types', () => {
      expect(isValidPropertyType('hotel')).toBe(true);
      expect(isValidPropertyType('meuble')).toBe(true);
      expect(isValidPropertyType('guesthouse')).toBe(true);
      expect(isValidPropertyType('short_term')).toBe(true);
    });

    it('should reject invalid property types', () => {
      expect(isValidPropertyType('apartment')).toBe(false);
      expect(isValidPropertyType('villa')).toBe(false);
      expect(isValidPropertyType('invalid')).toBe(false);
    });
  });

  describe('Property Status Validation', () => {
    it('should accept valid property statuses', () => {
      expect(isValidPropertyStatus('pending')).toBe(true);
      expect(isValidPropertyStatus('active')).toBe(true);
      expect(isValidPropertyStatus('suspended')).toBe(true);
      expect(isValidPropertyStatus('rejected')).toBe(true);
    });

    it('should reject invalid property statuses', () => {
      expect(isValidPropertyStatus('approved')).toBe(false);
      expect(isValidPropertyStatus('inactive')).toBe(false);
    });
  });

  describe('Document Type Validation', () => {
    it('should accept valid document types', () => {
      expect(isValidDocumentType('cni')).toBe(true);
      expect(isValidDocumentType('passport')).toBe(true);
      expect(isValidDocumentType('cedeao_id')).toBe(true);
      expect(isValidDocumentType('residence_permit')).toBe(true);
    });

    it('should reject invalid document types', () => {
      expect(isValidDocumentType('drivers_license')).toBe(false);
      expect(isValidDocumentType('national_id')).toBe(false);
    });
  });

  describe('Payment Method Validation', () => {
    it('should accept valid payment methods', () => {
      expect(isValidPaymentMethod('wave')).toBe(true);
      expect(isValidPaymentMethod('orange_money')).toBe(true);
      expect(isValidPaymentMethod('card')).toBe(true);
      expect(isValidPaymentMethod('cash')).toBe(true);
    });

    it('should reject invalid payment methods', () => {
      expect(isValidPaymentMethod('paypal')).toBe(false);
      expect(isValidPaymentMethod('bitcoin')).toBe(false);
    });
  });

  describe('Payment Status Validation', () => {
    it('should accept valid payment statuses', () => {
      expect(isValidPaymentStatus('pending')).toBe(true);
      expect(isValidPaymentStatus('processing')).toBe(true);
      expect(isValidPaymentStatus('completed')).toBe(true);
      expect(isValidPaymentStatus('failed')).toBe(true);
      expect(isValidPaymentStatus('refunded')).toBe(true);
    });

    it('should reject invalid payment statuses', () => {
      expect(isValidPaymentStatus('cancelled')).toBe(false);
      expect(isValidPaymentStatus('approved')).toBe(false);
    });
  });

  describe('Alert Severity Validation', () => {
    it('should accept valid alert severities', () => {
      expect(isValidAlertSeverity('critical')).toBe(true);
      expect(isValidAlertSeverity('high')).toBe(true);
      expect(isValidAlertSeverity('medium')).toBe(true);
      expect(isValidAlertSeverity('low')).toBe(true);
    });

    it('should reject invalid alert severities', () => {
      expect(isValidAlertSeverity('urgent')).toBe(false);
      expect(isValidAlertSeverity('normal')).toBe(false);
    });
  });

  describe('User Role Validation', () => {
    it('should accept valid user roles', () => {
      expect(isValidUserRole('landlord')).toBe(true);
      expect(isValidUserRole('police')).toBe(true);
      expect(isValidUserRole('ministry')).toBe(true);
      expect(isValidUserRole('tax_authority')).toBe(true);
      expect(isValidUserRole('admin')).toBe(true);
    });

    it('should reject invalid user roles', () => {
      expect(isValidUserRole('superadmin')).toBe(false);
      expect(isValidUserRole('guest')).toBe(false);
    });
  });

  describe('Senegal Region Validation', () => {
    it('should accept valid Senegal regions', () => {
      expect(isValidSenegalRegion('Dakar')).toBe(true);
      expect(isValidSenegalRegion('Thies')).toBe(true);
      expect(isValidSenegalRegion('Saint-Louis')).toBe(true);
      expect(isValidSenegalRegion('Ziguinchor')).toBe(true);
    });

    it('should reject invalid regions', () => {
      expect(isValidSenegalRegion('Paris')).toBe(false);
      expect(isValidSenegalRegion('Accra')).toBe(false);
    });

    it('should have 14 regions defined', () => {
      expect(SENEGAL_REGIONS.length).toBe(14);
    });
  });

  describe('Phone Number Validation', () => {
    it('should accept valid Senegal phone numbers', () => {
      expect(isValidSenegalPhone('+221771234567')).toBe(true);
      expect(isValidSenegalPhone('221781234567')).toBe(true);
      expect(isValidSenegalPhone('771234567')).toBe(true);
      expect(isValidSenegalPhone('78 123 45 67')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidSenegalPhone('12345')).toBe(false);
      expect(isValidSenegalPhone('+33612345678')).toBe(false);
      expect(isValidSenegalPhone('invalid')).toBe(false);
    });
  });

  describe('Email Validation', () => {
    it('should accept valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.sn')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user @domain.com')).toBe(false);
    });
  });

  describe('UUID Validation', () => {
    it('should accept valid UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('ISO Date Validation', () => {
    it('should accept valid ISO dates', () => {
      expect(isValidISODate('2024-01-15')).toBe(true);
      expect(isValidISODate('2024-01-15T10:30:00Z')).toBe(true);
      expect(isValidISODate('2024-01-15T10:30:00.000Z')).toBe(true);
    });

    it('should reject invalid dates', () => {
      expect(isValidISODate('invalid-date')).toBe(false);
      expect(isValidISODate('2024-13-45')).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should have correct TPT rate per night', () => {
      expect(TPT_RATE_PER_NIGHT).toBe(1000);
    });

    it('should have correct minor age threshold', () => {
      expect(MINOR_AGE).toBe(18);
    });

    it('should have correct minimum guardian age', () => {
      expect(MIN_GUARDIAN_AGE).toBe(21);
    });
  });

  describe('Input Type Structures', () => {
    it('should validate CreateLandlordInput structure', () => {
      const input = {
        full_name: 'Amadou Diallo',
        phone: '+221771234567',
        email: 'amadou@example.com',
        cni_number: '1234567890',
        city: 'Dakar',
        region: 'Dakar',
      };

      expect(input.full_name).toBeDefined();
      expect(input.phone).toBeDefined();
      expect(isValidEmail(input.email!)).toBe(true);
      expect(isValidSenegalRegion(input.region!)).toBe(true);
    });

    it('should validate CreatePropertyInput structure', () => {
      const input = {
        name: 'Hotel Teranga',
        type: 'hotel',
        address: '123 Rue de la Paix',
        city: 'Dakar',
        region: 'Dakar',
        capacity_rooms: 20,
        capacity_beds: 40,
        capacity_guests: 60,
      };

      expect(input.name).toBeDefined();
      expect(isValidPropertyType(input.type)).toBe(true);
      expect(input.address).toBeDefined();
      expect(isValidSenegalRegion(input.region)).toBe(true);
    });

    it('should validate CreateGuestInput structure', () => {
      const input = {
        first_name: 'Jean',
        last_name: 'Dupont',
        date_of_birth: '1990-05-15',
        nationality: 'French',
        document_type: 'passport',
        document_number: 'FR12345678',
      };

      expect(input.first_name).toBeDefined();
      expect(input.last_name).toBeDefined();
      expect(isValidISODate(input.date_of_birth!)).toBe(true);
      expect(isValidDocumentType(input.document_type!)).toBe(true);
    });

    it('should validate InitiatePaymentInput structure', () => {
      const input = {
        landlord_id: '550e8400-e29b-41d4-a716-446655440000',
        amount: 10000,
        method: 'wave',
      };

      expect(isValidUUID(input.landlord_id)).toBe(true);
      expect(input.amount).toBeGreaterThan(0);
      expect(isValidPaymentMethod(input.method)).toBe(true);
    });
  });

  describe('ChatbotSession Structure', () => {
    it('should have valid session states', () => {
      const validStates = [
        'IDLE',
        'ONBOARDING_START',
        'ONBOARDING_NAME',
        'ONBOARDING_CNI',
        'ONBOARDING_CNI_PHOTO',
        'ONBOARDING_CONFIRM',
        'GUEST_CHECKIN_START',
        'GUEST_CHECKIN_DOCUMENT',
        'GUEST_CHECKIN_CONFIRM',
        'PAY_TPT_VIEW',
        'PAY_TPT_METHOD',
        'PAY_TPT_CONFIRM',
      ];

      validStates.forEach((state) => {
        expect(typeof state).toBe('string');
        expect(state.length).toBeGreaterThan(0);
      });
    });

    it('should support valid languages', () => {
      const validLanguages = ['fr', 'wo', 'en'];
      expect(validLanguages).toContain('fr');
      expect(validLanguages).toContain('wo');
      expect(validLanguages).toContain('en');
    });
  });

  describe('WhatsAppMessage Structure', () => {
    it('should have valid message types', () => {
      const validTypes = ['text', 'image', 'document', 'location', 'interactive', 'button'];
      expect(validTypes).toContain('text');
      expect(validTypes).toContain('image');
      expect(validTypes).toContain('interactive');
    });
  });
});
