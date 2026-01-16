/**
 * ASR (Automatic Speech Recognition) Module
 *
 * Transcribes audio messages using the Modal transcription API.
 * Supports Wolof, French, and English.
 */

import axios from 'axios';
import FormData from 'form-data';

const TRANSCRIPTION_API_URL = 'https://andromeda--parallel-transcription-app-factory.modal.run/transcribe/';

export const SUPPORTED_LANGUAGES = {
  WOLOF: 'wo-SN',
  FRENCH: 'fr-FR',
  ENGLISH: 'en-US',
} as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[keyof typeof SUPPORTED_LANGUAGES];

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  success: boolean;
  text: string;
  segments: TranscriptionSegment[];
  error?: string;
}

export interface TranscriptionOptions {
  languageCode?: LanguageCode;
  samplingRate?: number;
  minSpeechDurationMs?: number;
  minSilenceDurationMs?: number;
  maxSpeechDurationS?: number;
}

const DEFAULT_OPTIONS: Required<TranscriptionOptions> = {
  languageCode: SUPPORTED_LANGUAGES.WOLOF,
  samplingRate: 16000,
  minSpeechDurationMs: 250,
  minSilenceDurationMs: 2000,
  maxSpeechDurationS: 50,
};

/**
 * Transcribe audio from a Buffer
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = 'audio.ogg',
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename,
      contentType: getContentType(filename),
    });
    formData.append('sampling_rate', opts.samplingRate.toString());
    formData.append('min_speech_duration_ms', opts.minSpeechDurationMs.toString());
    formData.append('min_silence_duration_ms', opts.minSilenceDurationMs.toString());
    formData.append('max_speech_duration_s', opts.maxSpeechDurationS.toString());
    formData.append('language_code', opts.languageCode);

    console.log(`[ASR] Transcribing audio (${audioBuffer.length} bytes), language: ${opts.languageCode}`);

    const response = await axios.post<{ values: TranscriptionSegment[] }>(
      TRANSCRIPTION_API_URL,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 120000, // 2 minutes
      }
    );

    const fullText = response.data.values
      .map((segment) => segment.text)
      .join(' ')
      .trim();

    console.log(`[ASR] Transcription successful: "${fullText.substring(0, 100)}${fullText.length > 100 ? '...' : ''}"`);

    return {
      success: true,
      text: fullText,
      segments: response.data.values,
    };
  } catch (error: any) {
    console.error('[ASR] Transcription error:', error.message);
    if (error.response) {
      console.error('[ASR] API response:', error.response.status, error.response.data);
    }
    return {
      success: false,
      text: '',
      segments: [],
      error: `Transcription failed: ${error.message}`,
    };
  }
}

/**
 * Transcribe audio from URL (downloads first)
 */
export async function transcribeFromUrl(
  audioUrl: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  try {
    console.log(`[ASR] Downloading audio from: ${audioUrl}`);

    const response = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const audioBuffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'audio/ogg';
    const extension = getExtension(contentType);

    console.log(`[ASR] Downloaded ${audioBuffer.length} bytes, type: ${contentType}`);

    return await transcribeAudio(audioBuffer, `audio.${extension}`, options);
  } catch (error: any) {
    console.error('[ASR] Download error:', error.message);
    return {
      success: false,
      text: '',
      segments: [],
      error: `Failed to download audio: ${error.message}`,
    };
  }
}

/**
 * Detect language from text (heuristic)
 */
export function detectLanguageFromText(text: string): LanguageCode {
  const wolofPatterns = /\b(nanga|def|mangi|fi|sama|yow|yaay|baay|jërejëf|waaw|déedéet|dara|nii|rekk|am|benn|ñu|mu|ci|bi|gi|ji|wi|mi|li)\b/i;
  const frenchPatterns = /\b(je|tu|il|elle|nous|vous|ils|les|des|est|sont|pour|avec|dans|qui|que|une|pas|mais|ou|donc)\b/i;

  if (wolofPatterns.test(text)) {
    return SUPPORTED_LANGUAGES.WOLOF;
  }
  if (frenchPatterns.test(text)) {
    return SUPPORTED_LANGUAGES.FRENCH;
  }
  return SUPPORTED_LANGUAGES.WOLOF; // Default for Senegal
}

function getExtension(contentType: string): string {
  const mapping: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/amr': 'amr',
  };
  return mapping[contentType.split(';')[0]] || 'ogg';
}

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mapping: Record<string, string> = {
    'ogg': 'audio/ogg',
    'opus': 'audio/opus',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'webm': 'audio/webm',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'amr': 'audio/amr',
  };
  return mapping[ext] || 'audio/ogg';
}
