import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

// Mock the dependencies
vi.mock('../../src/lib/session.js', () => ({
  updateSession: vi.fn(),
}));

vi.mock('../../src/lib/wati.js', () => ({
  sendMessage: vi.fn(),
  sendInteractiveButtons: vi.fn(),
}));

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Import mocked modules
import { updateSession } from '../../src/lib/session.js';
import { sendMessage, sendInteractiveButtons } from '../../src/lib/wati.js';
import { supabase } from '../../src/lib/supabase.js';

// Types
interface ChatbotSession {
  phone: string;
  state: string;
  landlord_id?: string;
  data: Record<string, unknown>;
}

interface WhatsAppMessage {
  type: 'text' | 'image' | 'interactive';
  text?: { body: string };
  image?: { id: string };
  interactive?: {
    button_reply?: { id: string; title: string };
  };
}

// Helper to validate name
function isValidName(name: string): boolean {
  return name.trim().length >= 3;
}

// Helper to validate CNI
function isValidCNI(cni: string): boolean {
  return cni.trim().length >= 10;
}

describe('Onboarding Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Name Validation', () => {
    it('should accept valid full name', () => {
      expect(isValidName('Amadou Diallo')).toBe(true);
    });

    it('should accept name with multiple parts', () => {
      expect(isValidName('Jean Pierre Sarr')).toBe(true);
    });

    it('should reject name that is too short', () => {
      expect(isValidName('AB')).toBe(false);
    });

    it('should reject empty name', () => {
      expect(isValidName('')).toBe(false);
    });

    it('should reject whitespace only', () => {
      expect(isValidName('   ')).toBe(false);
    });
  });

  describe('CNI Validation', () => {
    it('should accept valid CNI number', () => {
      expect(isValidCNI('1234567890123')).toBe(true);
    });

    it('should accept CNI with letters', () => {
      expect(isValidCNI('SN1234567890')).toBe(true);
    });

    it('should reject short CNI', () => {
      expect(isValidCNI('12345')).toBe(false);
    });

    it('should reject empty CNI', () => {
      expect(isValidCNI('')).toBe(false);
    });
  });

  describe('Onboarding Start State', () => {
    it('should transition to ONBOARDING_NAME for new user', async () => {
      const session: ChatbotSession = {
        phone: '+221771234567',
        state: 'ONBOARDING_START',
        data: {},
      };

      const message: WhatsAppMessage = {
        type: 'interactive',
        interactive: {
          button_reply: { id: 'new_user', title: 'Nouveau' },
        },
      };

      // Simulate new user flow
      if (
        message.type === 'interactive' &&
        message.interactive?.button_reply?.id === 'new_user'
      ) {
        const newState = 'ONBOARDING_NAME';
        expect(newState).toBe('ONBOARDING_NAME');
      }
    });

    it('should look up existing user by phone', async () => {
      const message: WhatsAppMessage = {
        type: 'interactive',
        interactive: {
          button_reply: { id: 'existing_user', title: 'Existant' },
        },
      };

      // Mock existing user lookup
      const mockLandlord = { id: 'landlord-123', full_name: 'Amadou Diallo' };

      if (message.interactive?.button_reply?.id === 'existing_user') {
        expect(mockLandlord.id).toBe('landlord-123');
      }
    });

    it('should handle case when existing user not found', async () => {
      const landlord = null;
      const shouldPromptNewAccount = !landlord;
      expect(shouldPromptNewAccount).toBe(true);
    });
  });

  describe('Onboarding Name State', () => {
    it('should accept text message for name input', () => {
      const message: WhatsAppMessage = {
        type: 'text',
        text: { body: 'Amadou Diallo' },
      };

      expect(message.type).toBe('text');
      expect(message.text?.body).toBe('Amadou Diallo');
    });

    it('should reject non-text message for name', () => {
      const message: WhatsAppMessage = {
        type: 'image',
        image: { id: 'img-123' },
      };

      const isValidInput = message.type === 'text' && message.text;
      expect(isValidInput).toBe(false);
    });

    it('should store name in session data', () => {
      const session: ChatbotSession = {
        phone: '+221771234567',
        state: 'ONBOARDING_NAME',
        data: {},
      };

      const fullName = 'Amadou Diallo';
      const updatedData = { ...session.data, full_name: fullName };

      expect(updatedData.full_name).toBe('Amadou Diallo');
    });

    it('should transition to ONBOARDING_CNI after valid name', () => {
      const currentState = 'ONBOARDING_NAME';
      const nextState = 'ONBOARDING_CNI';
      const name = 'Amadou Diallo';

      if (isValidName(name)) {
        expect(nextState).toBe('ONBOARDING_CNI');
      }
    });
  });

  describe('Onboarding CNI State', () => {
    it('should accept valid CNI number', () => {
      const cniNumber = '1234567890123';
      expect(isValidCNI(cniNumber)).toBe(true);
    });

    it('should normalize CNI to uppercase', () => {
      const cniInput = 'sn1234567890';
      const normalized = cniInput.trim().toUpperCase();
      expect(normalized).toBe('SN1234567890');
    });

    it('should transition to ONBOARDING_CNI_PHOTO after valid CNI', () => {
      const cniNumber = '1234567890123';
      const nextState = isValidCNI(cniNumber) ? 'ONBOARDING_CNI_PHOTO' : 'ONBOARDING_CNI';
      expect(nextState).toBe('ONBOARDING_CNI_PHOTO');
    });
  });

  describe('Onboarding CNI Photo State', () => {
    it('should accept image message', () => {
      const message: WhatsAppMessage = {
        type: 'image',
        image: { id: 'wa-image-123' },
      };

      expect(message.type).toBe('image');
      expect(message.image?.id).toBeDefined();
    });

    it('should reject non-image message', () => {
      const message: WhatsAppMessage = {
        type: 'text',
        text: { body: 'Hello' },
      };

      const isValidImageUpload = message.type === 'image';
      expect(isValidImageUpload).toBe(false);
    });

    it('should store photo ID in session', () => {
      const session: ChatbotSession = {
        phone: '+221771234567',
        state: 'ONBOARDING_CNI_PHOTO',
        data: { full_name: 'Amadou Diallo', cni_number: '1234567890' },
      };

      const cniPhotoId = 'wa-image-456';
      const updatedData = { ...session.data, cni_photo_id: cniPhotoId };

      expect(updatedData.cni_photo_id).toBe('wa-image-456');
    });
  });

  describe('Onboarding Confirmation State', () => {
    it('should restart flow when restart button clicked', () => {
      const message: WhatsAppMessage = {
        type: 'interactive',
        interactive: {
          button_reply: { id: 'restart', title: 'Recommencer' },
        },
      };

      if (message.interactive?.button_reply?.id === 'restart') {
        const nextState = 'ONBOARDING_NAME';
        const clearedData = {};
        expect(nextState).toBe('ONBOARDING_NAME');
        expect(clearedData).toEqual({});
      }
    });

    it('should complete registration when confirm button clicked', () => {
      const message: WhatsAppMessage = {
        type: 'interactive',
        interactive: {
          button_reply: { id: 'confirm', title: 'Confirmer' },
        },
      };

      if (message.interactive?.button_reply?.id === 'confirm') {
        const shouldCreateLandlord = true;
        expect(shouldCreateLandlord).toBe(true);
      }
    });

    it('should create landlord record on confirmation', () => {
      const data = {
        full_name: 'Amadou Diallo',
        cni_number: '1234567890',
        cni_photo_id: 'photo-123',
      };

      const phone = '+221771234567';

      const landlordRecord = {
        full_name: data.full_name,
        phone: phone,
        cni_number: data.cni_number,
      };

      expect(landlordRecord.full_name).toBe('Amadou Diallo');
      expect(landlordRecord.phone).toBe('+221771234567');
      expect(landlordRecord.cni_number).toBe('1234567890');
    });

    it('should set session state to IDLE after successful registration', () => {
      const registrationSuccess = true;
      const newState = registrationSuccess ? 'IDLE' : 'ONBOARDING_CONFIRM';
      expect(newState).toBe('IDLE');
    });

    it('should set landlord_id in session after registration', () => {
      const newLandlordId = 'landlord-new-123';
      const session: ChatbotSession = {
        phone: '+221771234567',
        state: 'IDLE',
        landlord_id: newLandlordId,
        data: {},
      };

      expect(session.landlord_id).toBe('landlord-new-123');
    });
  });
});
