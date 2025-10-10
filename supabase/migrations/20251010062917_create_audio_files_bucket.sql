-- Create audio_files storage bucket for TTS audio files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio_files',
  'audio_files',
  true,
  52428800, -- 50MB max file size
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav']
);

-- Enable public access for audio files
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio_files');

-- Enable authenticated uploads
CREATE POLICY "Authenticated Uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audio_files' AND auth.role() = 'authenticated');

-- Enable authenticated deletions
CREATE POLICY "Authenticated Deletions"
ON storage.objects FOR DELETE
USING (bucket_id = 'audio_files' AND auth.role() = 'authenticated');
