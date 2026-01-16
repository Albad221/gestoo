-- Create TTS audio storage bucket for voice message responses
-- Run this in Supabase SQL Editor or via migration

-- Create the tts-audio bucket (public for WATI to access audio URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tts-audio', 'tts-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access (needed for WATI to fetch audio)
CREATE POLICY "Public read access for tts-audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'tts-audio');

-- Allow service role uploads
CREATE POLICY "Service upload access for tts-audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tts-audio');

-- Allow service role to update/delete (for cleanup)
CREATE POLICY "Service manage access for tts-audio"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tts-audio');

CREATE POLICY "Service delete access for tts-audio"
ON storage.objects FOR DELETE
USING (bucket_id = 'tts-audio');
