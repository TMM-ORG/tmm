/**
 * Supabase Storage Service
 * Handles database operations for selected posts and audio files
 */

import { createServerClient } from '@lib/supabase';
import { SelectedPost, AudioFile, Database } from '@/types/database';
import { RedditPost } from '@/types/reddit';
import { PostScore } from '@/services/reddit/analyzer';

// Custom error for storage operations
export class StorageError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'StorageError';
  }
}

// Audio file upload result
export interface AudioUploadResult {
  audioFileId: string;
  publicUrl: string;
  fileSize: number;
}

class SupabaseStorageService {
  private readonly AUDIO_BUCKET = 'audio_files';

  /**
   * Get typed Supabase client
   */
  private getClient() {
    return createServerClient();
  }

  /**
   * Save selected post to database
   * @param post - Reddit post to save
   * @param score - Post score from analyzer
   * @returns The saved post record
   */
  async saveSelectedPost(post: RedditPost, score: PostScore): Promise<SelectedPost> {
    const supabase = this.getClient();

    try {
      const postData: Database['public']['Tables']['selected_posts']['Insert'] = {
        reddit_post_id: post.id,
        subreddit: post.subreddit,
        title: post.title,
        selftext: post.selftext || null,
        score: post.score,
        num_comments: post.num_comments,
        author: post.author,
        created_utc: new Date(post.created_utc * 1000).toISOString(),
        selection_score: score.totalScore,
        audio_file_id: null
      };

      const { data, error } = await supabase
        .from('selected_posts')
        .insert(postData)
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation (post already selected)
        if (error.code === '23505') {
          throw new StorageError(
            `Post ${post.id} has already been selected`,
            'DUPLICATE_POST'
          );
        }

        throw new StorageError(
          `Failed to save selected post: ${error.message}`,
          'DB_INSERT_ERROR'
        );
      }

      if (!data) {
        throw new StorageError('No data returned from insert', 'NO_DATA');
      }

      return data as SelectedPost;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError(
        `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DB_ERROR'
      );
    }
  }

  /**
   * Save audio file metadata to database
   * @param audioData - Audio file metadata
   * @returns The saved audio file record
   */
  async saveAudioFile(audioData: {
    fileUrl: string;
    durationSeconds: number;
    fileSizeBytes: number;
    format: string;
    ttsProvider: 'elevenlabs' | 'inworld';
    voiceUsed: string;
  }): Promise<AudioFile> {
    const supabase = this.getClient();

    try {
      const fileData: Database['public']['Tables']['audio_files']['Insert'] = {
        file_url: audioData.fileUrl,
        duration_seconds: audioData.durationSeconds,
        file_size_bytes: audioData.fileSizeBytes,
        format: audioData.format,
        tts_provider: audioData.ttsProvider,
        voice_used: audioData.voiceUsed
      };

      const { data, error } = await supabase
        .from('audio_files')
        .insert(fileData)
        .select()
        .single();

      if (error) {
        throw new StorageError(
          `Failed to save audio file: ${error.message}`,
          'DB_INSERT_ERROR'
        );
      }

      if (!data) {
        throw new StorageError('No data returned from insert', 'NO_DATA');
      }

      return data as AudioFile;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError(
        `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DB_ERROR'
      );
    }
  }

  /**
   * Link audio file to selected post
   * @param postId - Selected post ID
   * @param audioFileId - Audio file ID
   */
  async linkAudioToPost(postId: string, audioFileId: string): Promise<void> {
    const supabase = this.getClient();

    try {
      const { error } = await supabase
        .from('selected_posts')
        .update({ audio_file_id: audioFileId })
        .eq('id', postId);

      if (error) {
        throw new StorageError(
          `Failed to link audio to post: ${error.message}`,
          'DB_UPDATE_ERROR'
        );
      }
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError(
        `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DB_ERROR'
      );
    }
  }

  /**
   * Upload audio file to Supabase Storage
   * @param audioBuffer - Audio file buffer
   * @param fileName - Name for the file
   * @param contentType - MIME type
   * @returns Upload result with public URL
   */
  async uploadAudioFile(
    audioBuffer: Buffer,
    fileName: string,
    contentType: string = 'audio/mpeg'
  ): Promise<AudioUploadResult> {
    const supabase = this.getClient();

    try {
      // Upload to storage bucket
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from(this.AUDIO_BUCKET)
        .upload(fileName, audioBuffer, {
          contentType,
          upsert: false
        });

      if (uploadError) {
        throw new StorageError(
          `Failed to upload audio file: ${uploadError.message}`,
          'UPLOAD_ERROR'
        );
      }

      if (!uploadData) {
        throw new StorageError('No upload data returned', 'NO_DATA');
      }

      // Get public URL (signed URL for private buckets)
      const { data: urlData } = supabase
        .storage
        .from(this.AUDIO_BUCKET)
        .getPublicUrl(uploadData.path);

      if (!urlData) {
        throw new StorageError('Failed to get public URL', 'URL_ERROR');
      }

      return {
        audioFileId: uploadData.path,
        publicUrl: urlData.publicUrl,
        fileSize: audioBuffer.length
      };
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError(
        `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STORAGE_ERROR'
      );
    }
  }

  /**
   * Get selected post by Reddit post ID
   * @param redditPostId - Reddit post ID
   * @returns Selected post with audio file data if exists
   */
  async getSelectedPostByRedditId(redditPostId: string): Promise<SelectedPost | null> {
    const supabase = this.getClient();

    try {
      const { data, error } = await supabase
        .from('selected_posts')
        .select('*')
        .eq('reddit_post_id', redditPostId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }

        throw new StorageError(
          `Failed to get selected post: ${error.message}`,
          'DB_SELECT_ERROR'
        );
      }

      return data as SelectedPost;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError(
        `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DB_ERROR'
      );
    }
  }

  /**
   * Delete old audio files (cleanup utility)
   * @param olderThanDays - Delete files older than this many days
   * @returns Number of deleted files
   */
  async cleanupOldAudioFiles(olderThanDays: number = 30): Promise<number> {
    const supabase = this.getClient();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Get old audio files
      const { data: oldFiles, error: selectError } = await supabase
        .from('audio_files')
        .select('id, file_url')
        .lt('created_at', cutoffDate.toISOString());

      if (selectError) {
        throw new StorageError(
          `Failed to query old files: ${selectError.message}`,
          'DB_SELECT_ERROR'
        );
      }

      if (!oldFiles || oldFiles.length === 0) {
        return 0;
      }

      // Delete from storage
      const filePaths = oldFiles.map(f => f.file_url.split('/').pop() || '').filter(Boolean);

      if (filePaths.length > 0) {
        const { error: storageError } = await supabase
          .storage
          .from(this.AUDIO_BUCKET)
          .remove(filePaths);

        if (storageError) {
          console.error('Storage cleanup error:', storageError);
        }
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('audio_files')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (deleteError) {
        throw new StorageError(
          `Failed to delete old files: ${deleteError.message}`,
          'DB_DELETE_ERROR'
        );
      }

      return oldFiles.length;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError(
        `Cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLEANUP_ERROR'
      );
    }
  }
}

// Export singleton instance
export const supabaseStorage = new SupabaseStorageService();
