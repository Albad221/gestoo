import Redis from 'ioredis';
import type { ChatbotSession, ChatbotState } from '@gestoo/types';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
console.log('[SESSION] Connecting to Redis:', redisUrl.replace(/\/\/.*@/, '//***@'));

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('[SESSION] Redis connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[SESSION] Connected to Redis');
});

const SESSION_TTL = 60 * 60 * 24; // 24 hours

export async function getSession(phone: string): Promise<ChatbotSession> {
  const key = `chatbot:session:${phone}`;

  try {
    await redis.connect().catch(() => {}); // Ensure connected
    const data = await redis.get(key);

    if (data) {
      console.log(`[SESSION] Found existing session for ${phone}:`, JSON.parse(data).state);
      return JSON.parse(data) as ChatbotSession;
    }
  } catch (error) {
    console.error(`[SESSION] Error getting session for ${phone}:`, error);
  }

  // Return default session
  console.log(`[SESSION] Creating new session for ${phone}`);
  return {
    phone,
    state: 'IDLE',
    data: {},
    last_activity: new Date().toISOString(),
    language: 'fr',
  };
}

export async function updateSession(
  phone: string,
  updates: Partial<ChatbotSession>
): Promise<void> {
  const key = `chatbot:session:${phone}`;

  try {
    await redis.connect().catch(() => {}); // Ensure connected
    const current = await getSession(phone);

    const updated: ChatbotSession = {
      ...current,
      ...updates,
      last_activity: new Date().toISOString(),
    };

    await redis.setex(key, SESSION_TTL, JSON.stringify(updated));
    console.log(`[SESSION] Updated session for ${phone}: state=${updated.state}`);
  } catch (error) {
    console.error(`[SESSION] Error updating session for ${phone}:`, error);
  }
}

export async function clearSession(phone: string): Promise<void> {
  const key = `chatbot:session:${phone}`;

  try {
    await redis.connect().catch(() => {}); // Ensure connected
    await redis.del(key);
    console.log(`[SESSION] Cleared session for ${phone}`);
  } catch (error) {
    console.error(`[SESSION] Error clearing session for ${phone}:`, error);
  }
}
