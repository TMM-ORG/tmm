// Database types for Supabase
// This file will be expanded as we define database schemas in future stories

export interface Database {
  public: {
    Tables: {
      // Tables will be defined as we create them in future stories
      // Example structure:
      // selected_posts: {
      //   Row: SelectedPost;
      //   Insert: Omit<SelectedPost, 'id' | 'created_at'>;
      //   Update: Partial<Omit<SelectedPost, 'id'>>;
      // };
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

// Basic types that will be used across the application
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}