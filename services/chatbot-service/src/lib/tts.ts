/**
 * TTS (Text-to-Speech) Module
 *
 * Generates speech audio from text using the Modal Gemini TTS API.
 * Supports French and Wolof for Senegalese users.
 */

import axios from 'axios';
import { supabase } from './supabase.js';

const TTS_API_URL = 'https://andromeda--gemini-tts-app-factory.modal.run/tts/';

export interface TTSResult {
  success: boolean;
  audioBuffer?: Buffer;
  mimeType: string;
  error?: string;
}

export interface TTSOptions {
  voice?: 'female' | 'male';
  language?: 'fr' | 'wo' | 'en';
  style?: 'friendly' | 'professional' | 'warm';
}

const DEFAULT_OPTIONS: Required<TTSOptions> = {
  voice: 'female',
  language: 'fr',
  style: 'warm',
};

/**
 * Generate voice prompt based on options
 */
function buildVoicePrompt(options: Required<TTSOptions>): string {
  const voiceDescriptions = {
    female: 'a warm, friendly female voice',
    male: 'a calm, professional male voice',
  };

  const languageHints = {
    fr: 'Speak in clear French with a slight Senegalese accent.',
    wo: 'Speak naturally mixing Wolof expressions when appropriate.',
    en: 'Speak in clear English.',
  };

  const styleHints = {
    friendly: 'Sound approachable and helpful, like a helpful neighbor.',
    professional: 'Sound professional and competent.',
    warm: 'Sound warm and caring, like a trusted assistant.',
  };

  return `Use ${voiceDescriptions[options.voice]}. ${languageHints[options.language]} ${styleHints[options.style]} Keep a natural conversational pace.`;
}

/**
 * Generate speech audio from text
 *
 * @param text - The text to convert to speech
 * @param options - Voice and style options
 * @returns TTSResult with audio buffer
 */
export async function textToSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Skip TTS for very short or empty text
  if (!text || text.trim().length < 3) {
    return {
      success: false,
      mimeType: 'audio/wav',
      error: 'Text too short for TTS',
    };
  }

  // Limit text length to avoid very long audio (shorter = faster TTS)
  const maxLength = 300;
  const truncatedText = text.length > maxLength
    ? text.substring(0, maxLength) + '...'
    : text;

  try {
    const prompt = buildVoicePrompt(opts);

    console.log(`[TTS] Generating speech for: "${truncatedText.substring(0, 50)}${truncatedText.length > 50 ? '...' : ''}"`);
    console.log(`[TTS] Voice prompt: "${prompt}"`);

    // Send as form-urlencoded
    const params = new URLSearchParams();
    params.append('text', truncatedText);
    params.append('prompt', prompt);

    const response = await axios.post(TTS_API_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      responseType: 'arraybuffer',
      timeout: 180000, // 3 minute timeout for TTS generation
    });

    const audioBuffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'audio/wav';

    console.log(`[TTS] Generated ${audioBuffer.length} bytes of audio (${contentType})`);

    return {
      success: true,
      audioBuffer,
      mimeType: contentType,
    };
  } catch (error: any) {
    console.error('[TTS] Generation error:', error.message);
    if (error.response) {
      console.error('[TTS] API response:', error.response.status, error.response.data?.toString?.()?.substring(0, 200));
    }
    return {
      success: false,
      mimeType: 'audio/wav',
      error: `TTS failed: ${error.message}`,
    };
  }
}

/**
 * Detect if response should use TTS based on context
 * Use TTS when:
 * - User sent a voice message (they prefer audio)
 * - Response is short enough to be spoken naturally
 */
export function shouldUseTTS(
  inputWasAudio: boolean,
  responseText: string
): boolean {
  // Only use TTS if input was audio (user prefers voice)
  if (!inputWasAudio) {
    return false;
  }

  // Skip TTS for long responses (over 300 chars) to keep audio short
  if (responseText.length > 300) {
    return false;
  }

  // Skip TTS for responses with lots of formatting/lists
  const hasComplexFormatting =
    (responseText.match(/\n/g) || []).length > 5 ||
    (responseText.match(/[•\-\*]/g) || []).length > 3 ||
    (responseText.match(/\d+\./g) || []).length > 2;

  if (hasComplexFormatting) {
    return false;
  }

  return true;
}

/**
 * Detect language from text for TTS
 */
export function detectLanguageForTTS(text: string): 'fr' | 'wo' | 'en' {
  const wolofPatterns = /\b(nanga|def|mangi|fi|sama|yow|yaay|baay|jërëjëf|waaw|déedéet|dara|nii|rekk|am|benn|ñu|mu|ci|bi|gi|ji|wi|mi|li)\b/i;
  const englishPatterns = /\b(the|is|are|was|were|have|has|been|will|would|could|should|this|that|these|those|what|where|when|how|why)\b/i;

  if (wolofPatterns.test(text)) {
    return 'wo';
  }
  if (englishPatterns.test(text)) {
    return 'en';
  }
  return 'fr'; // Default to French for Senegal
}

const TTS_BUCKET = 'tts-audio';

/**
 * Upload TTS audio to Supabase storage and get public URL
 *
 * @param audioBuffer - The audio buffer to upload
 * @param phone - User phone number (for folder organization)
 * @returns Public URL of the uploaded audio or null
 */
export async function uploadTTSAudio(
  audioBuffer: Buffer,
  phone: string
): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const fileName = `${phone}/${timestamp}.wav`;

    console.log(`[TTS] Uploading audio to storage: ${fileName}`);

    // Try to upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(TTS_BUCKET)
      .upload(fileName, audioBuffer, {
        contentType: 'audio/wav',
        upsert: true,
      });

    if (error) {
      console.error('[TTS] Storage upload error:', error.message);
      // If bucket doesn't exist, we can't send audio
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(TTS_BUCKET)
      .getPublicUrl(fileName);

    const publicUrl = urlData?.publicUrl;
    console.log(`[TTS] Audio uploaded: ${publicUrl}`);

    return publicUrl || null;
  } catch (error: any) {
    console.error('[TTS] Upload failed:', error.message);
    return null;
  }
}

/**
 * Generate speech and upload to storage for sending via WhatsApp
 *
 * @param text - Text to convert to speech
 * @param phone - User phone number
 * @param options - TTS options
 * @returns Public URL of the audio or null
 */
export async function generateAndUploadTTS(
  text: string,
  phone: string,
  options: TTSOptions = {}
): Promise<string | null> {
  // Generate audio
  const result = await textToSpeech(text, options);

  if (!result.success || !result.audioBuffer) {
    console.error('[TTS] Generation failed:', result.error);
    return null;
  }

  // Upload to storage
  const audioUrl = await uploadTTSAudio(result.audioBuffer, phone);

  return audioUrl;
}
