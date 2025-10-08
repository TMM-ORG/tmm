-- Story 1.2: Post Selection & TTS Integration
-- Create tables for selected posts and audio files

-- Create audio_files table (using gen_random_uuid() which is built-in)
CREATE TABLE IF NOT EXISTS audio_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_url TEXT NOT NULL,
  duration_seconds DECIMAL NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  format TEXT NOT NULL DEFAULT 'mp3',
  tts_provider TEXT NOT NULL CHECK (tts_provider IN ('elevenlabs', 'inworld')),
  voice_used TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create selected_posts table
CREATE TABLE IF NOT EXISTS selected_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reddit_post_id TEXT UNIQUE NOT NULL,
  subreddit TEXT NOT NULL,
  title TEXT NOT NULL,
  selftext TEXT,
  score INTEGER NOT NULL,
  num_comments INTEGER NOT NULL,
  author TEXT NOT NULL,
  created_utc TIMESTAMP WITH TIME ZONE NOT NULL,
  selection_score DECIMAL NOT NULL,
  audio_file_id UUID REFERENCES audio_files(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_selected_posts_reddit_id ON selected_posts(reddit_post_id);
CREATE INDEX IF NOT EXISTS idx_selected_posts_subreddit ON selected_posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_selected_posts_created_at ON selected_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_files_created_at ON audio_files(created_at DESC);

-- Create storage bucket for audio files (via Supabase Storage API)
-- Note: This needs to be done via Supabase dashboard or API, not SQL
-- Bucket name: 'audio_files'
-- Public: false (signed URLs will be used)

-- Add RLS (Row Level Security) policies
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE selected_posts ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything
CREATE POLICY "Service role can manage audio files" ON audio_files
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage selected posts" ON selected_posts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to read
CREATE POLICY "Authenticated users can read audio files" ON audio_files
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read selected posts" ON selected_posts
  FOR SELECT
  TO authenticated
  USING (true);

-- Comments for documentation
COMMENT ON TABLE audio_files IS 'Stores metadata for generated TTS audio files';
COMMENT ON TABLE selected_posts IS 'Stores selected Reddit posts with their metadata and selection scores';
COMMENT ON COLUMN selected_posts.selection_score IS 'Calculated score from post analyzer (0-1 range)';
COMMENT ON COLUMN audio_files.tts_provider IS 'TTS service used: elevenlabs or inworld';
