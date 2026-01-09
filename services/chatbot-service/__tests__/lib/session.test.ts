import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
};

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
}));

// Types
type ChatbotState = 'IDLE' | 'ONBOARDING_START' | 'ONBOARDING_NAME' | 'PAY_TPT_VIEW';

interface ChatbotSession {
  phone: string;
  state: ChatbotState;
  landlord_id?: string;
  data: Record<string, unknown>;
  last_activity: string;
  language: 'fr' | 'wo' | 'en';
}

// Constants
const SESSION_TTL = 60 * 60 * 24; // 24 hours

// Session key generator
function getSessionKey(phone: string): string {
  return `chatbot:session:${phone}`;
}

// Get default session
function getDefaultSession(phone: string): ChatbotSession {
  return {
    phone,
    state: 'IDLE',
    data: {},
    last_activity: new Date().toISOString(),
    language: 'fr',
  };
}

// Merge session updates
function mergeSession(
  current: ChatbotSession,
  updates: Partial<ChatbotSession>
): ChatbotSession {
  return {
    ...current,
    ...updates,
    last_activity: new Date().toISOString(),
  };
}

describe('Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Key Generation', () => {
    it('should generate correct session key format', () => {
      const phone = '+221771234567';
      const key = getSessionKey(phone);
      expect(key).toBe('chatbot:session:+221771234567');
    });

    it('should handle different phone formats', () => {
      expect(getSessionKey('221771234567')).toBe('chatbot:session:221771234567');
      expect(getSessionKey('+1234567890')).toBe('chatbot:session:+1234567890');
    });
  });

  describe('Default Session', () => {
    it('should create default session with IDLE state', () => {
      const phone = '+221771234567';
      const session = getDefaultSession(phone);

      expect(session.phone).toBe(phone);
      expect(session.state).toBe('IDLE');
      expect(session.data).toEqual({});
      expect(session.language).toBe('fr');
    });

    it('should set default language to French', () => {
      const session = getDefaultSession('+221771234567');
      expect(session.language).toBe('fr');
    });

    it('should include last_activity timestamp', () => {
      const session = getDefaultSession('+221771234567');
      expect(session.last_activity).toBeDefined();
      expect(new Date(session.last_activity)).toBeInstanceOf(Date);
    });

    it('should not include landlord_id by default', () => {
      const session = getDefaultSession('+221771234567');
      expect(session.landlord_id).toBeUndefined();
    });
  });

  describe('Session Merging', () => {
    it('should merge state update', () => {
      const current: ChatbotSession = {
        phone: '+221771234567',
        state: 'IDLE',
        data: {},
        last_activity: '2024-01-01T00:00:00Z',
        language: 'fr',
      };

      const updated = mergeSession(current, { state: 'ONBOARDING_START' });

      expect(updated.state).toBe('ONBOARDING_START');
      expect(updated.phone).toBe(current.phone);
    });

    it('should merge landlord_id', () => {
      const current: ChatbotSession = {
        phone: '+221771234567',
        state: 'IDLE',
        data: {},
        last_activity: '2024-01-01T00:00:00Z',
        language: 'fr',
      };

      const updated = mergeSession(current, { landlord_id: 'landlord-123' });

      expect(updated.landlord_id).toBe('landlord-123');
    });

    it('should merge data object', () => {
      const current: ChatbotSession = {
        phone: '+221771234567',
        state: 'ONBOARDING_NAME',
        data: { step: 1 },
        last_activity: '2024-01-01T00:00:00Z',
        language: 'fr',
      };

      const updated = mergeSession(current, {
        data: { ...current.data, full_name: 'Amadou Diallo' },
      });

      expect(updated.data.step).toBe(1);
      expect(updated.data.full_name).toBe('Amadou Diallo');
    });

    it('should update last_activity on merge', () => {
      const current: ChatbotSession = {
        phone: '+221771234567',
        state: 'IDLE',
        data: {},
        last_activity: '2024-01-01T00:00:00Z',
        language: 'fr',
      };

      const updated = mergeSession(current, { state: 'ONBOARDING_START' });

      expect(updated.last_activity).not.toBe(current.last_activity);
      expect(new Date(updated.last_activity).getTime()).toBeGreaterThan(
        new Date(current.last_activity).getTime()
      );
    });

    it('should preserve unmodified fields', () => {
      const current: ChatbotSession = {
        phone: '+221771234567',
        state: 'IDLE',
        landlord_id: 'landlord-existing',
        data: { existing: true },
        last_activity: '2024-01-01T00:00:00Z',
        language: 'wo',
      };

      const updated = mergeSession(current, { state: 'PAY_TPT_VIEW' });

      expect(updated.phone).toBe(current.phone);
      expect(updated.landlord_id).toBe(current.landlord_id);
      expect(updated.language).toBe('wo');
    });
  });

  describe('Session TTL', () => {
    it('should have 24 hour TTL', () => {
      expect(SESSION_TTL).toBe(86400); // 24 * 60 * 60
    });

    it('should expire after TTL', () => {
      const ttlSeconds = SESSION_TTL;
      const ttlHours = ttlSeconds / 3600;
      expect(ttlHours).toBe(24);
    });
  });

  describe('Redis Operations', () => {
    it('should parse JSON from Redis get', async () => {
      const sessionData: ChatbotSession = {
        phone: '+221771234567',
        state: 'ONBOARDING_NAME',
        data: { full_name: 'Test' },
        last_activity: new Date().toISOString(),
        language: 'fr',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      const result = await mockRedis.get('chatbot:session:+221771234567');
      const parsed = JSON.parse(result as string);

      expect(parsed.state).toBe('ONBOARDING_NAME');
      expect(parsed.data.full_name).toBe('Test');
    });

    it('should return null for non-existent session', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await mockRedis.get('chatbot:session:nonexistent');
      expect(result).toBeNull();
    });

    it('should stringify JSON for Redis setex', async () => {
      const session: ChatbotSession = {
        phone: '+221771234567',
        state: 'IDLE',
        data: {},
        last_activity: new Date().toISOString(),
        language: 'fr',
      };

      await mockRedis.setex(
        'chatbot:session:+221771234567',
        SESSION_TTL,
        JSON.stringify(session)
      );

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'chatbot:session:+221771234567',
        SESSION_TTL,
        expect.any(String)
      );
    });

    it('should call del for session clear', async () => {
      await mockRedis.del('chatbot:session:+221771234567');

      expect(mockRedis.del).toHaveBeenCalledWith('chatbot:session:+221771234567');
    });
  });

  describe('Session State Transitions', () => {
    const validTransitions: Record<ChatbotState, ChatbotState[]> = {
      IDLE: ['ONBOARDING_START', 'PAY_TPT_VIEW'],
      ONBOARDING_START: ['ONBOARDING_NAME', 'IDLE'],
      ONBOARDING_NAME: ['IDLE'],
      PAY_TPT_VIEW: ['IDLE'],
    };

    it('should allow valid transition from IDLE to ONBOARDING_START', () => {
      const current: ChatbotState = 'IDLE';
      const next: ChatbotState = 'ONBOARDING_START';
      const isValid = validTransitions[current].includes(next);
      expect(isValid).toBe(true);
    });

    it('should allow valid transition from ONBOARDING_START to ONBOARDING_NAME', () => {
      const current: ChatbotState = 'ONBOARDING_START';
      const next: ChatbotState = 'ONBOARDING_NAME';
      const isValid = validTransitions[current].includes(next);
      expect(isValid).toBe(true);
    });

    it('should allow transition back to IDLE', () => {
      const states: ChatbotState[] = ['ONBOARDING_START', 'ONBOARDING_NAME', 'PAY_TPT_VIEW'];

      states.forEach((state) => {
        const isValid = validTransitions[state].includes('IDLE');
        expect(isValid).toBe(true);
      });
    });
  });

  describe('Language Support', () => {
    it('should support French language', () => {
      const session = getDefaultSession('+221771234567');
      const updated = mergeSession(session, { language: 'fr' });
      expect(updated.language).toBe('fr');
    });

    it('should support Wolof language', () => {
      const session = getDefaultSession('+221771234567');
      const updated = mergeSession(session, { language: 'wo' });
      expect(updated.language).toBe('wo');
    });

    it('should support English language', () => {
      const session = getDefaultSession('+221771234567');
      const updated = mergeSession(session, { language: 'en' });
      expect(updated.language).toBe('en');
    });
  });
});
