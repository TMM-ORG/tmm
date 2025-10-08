// Database types for Supabase

// Basic types that will be used across the application
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

// Audio file metadata interface
export interface AudioFile {
  id: string;
  file_url: string;
  duration_seconds: number;
  file_size_bytes: number;
  format: string;
  tts_provider: 'elevenlabs' | 'inworld';
  voice_used: string;
  created_at: string;
}

// Selected post interface
export interface SelectedPost {
  id: string;
  reddit_post_id: string;
  subreddit: string;
  title: string;
  selftext: string | null;
  score: number;
  num_comments: number;
  author: string;
  created_utc: string;
  selection_score: number;
  audio_file_id: string | null;
  created_at: string;
}

// Database schema type definition
export interface Database {
  public: {
    Tables: {
      audio_files: {
        Row: AudioFile;
        Insert: Omit<AudioFile, 'id' | 'created_at'>;
        Update: Partial<Omit<AudioFile, 'id' | 'created_at'>>;
      };
      selected_posts: {
        Row: SelectedPost;
        Insert: Omit<SelectedPost, 'id' | 'created_at'>;
        Update: Partial<Omit<SelectedPost, 'id' | 'created_at'>>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}