import Redis from 'ioredis';
import type { ChatbotSession, ChatbotState } from '@gestoo/types';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const SESSION_TTL = 60 * 60 * 24; // 24 hours

export async function getSession(phone: string): Promise<ChatbotSession> {
  const key = `chatbot:session:${phone}`;
  const data = await redis.get(key);

  if (data) {
    return JSON.parse(data) as ChatbotSession;
  }

  // Return default session
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
  const current = await getSession(phone);

  const updated: ChatbotSession = {
    ...current,
    ...updates,
    last_activity: new Date().toISOString(),
  };

  await redis.setex(key, SESSION_TTL, JSON.stringify(updated));
}

export async function clearSession(phone: string): Promise<void> {
  const key = `chatbot:session:${phone}`;
  await redis.del(key);
}
