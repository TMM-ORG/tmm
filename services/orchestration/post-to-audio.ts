/**
 * Post-to-Audio Orchestration Service
 * Coordinates post selection, TTS generation, and storage
 */

import { RedditPost } from '@/types/reddit';
import { postAnalyzer } from '@/services/reddit/analyzer';
import { ttsService, TTSServiceError } from '@/services/tts';
import { supabaseStorage, StorageError } from '@/services/storage/supabase';
import { SelectedPost, AudioFile } from '@/types/database';

// Orchestration error
export class OrchestrationError extends Error {
  constructor(message: string, public code: string, public cause?: Error) {
    super(message);
    this.name = 'OrchestrationError';
  }
}

// Complete result with all metadata
export interface PostToAudioResult {
  selectedPost: SelectedPost;
  audioFile: AudioFile;
  audioUrl: string;
  duration: number;
}

class PostToAudioOrchestrator {
  /**
   * Generate unique filename for audio
   * @param postId - Reddit post ID
   * @param provider - TTS provider name
   * @returns Unique filename
   */
  private generateAudioFileName(postId: string, provider: string): string {
    const timestamp = Date.now();
    return `${postId}_${provider}_${timestamp}.mp3`;
  }

  /**
   * Complete workflow: analyze posts, select best, generate audio, store everything
   * @param posts - Array of Reddit posts to analyze
   * @returns Complete result with post, audio file, and metadata
   * @throws OrchestrationError if any step fails
   */
  async processPostToAudio(posts: RedditPost[]): Promise<PostToAudioResult> {
    if (!posts || posts.length === 0) {
      throw new OrchestrationError(
        'No posts provided for processing',
        'EMPTY_POSTS_ARRAY'
      );
    }

    try {
      // Step 1: Analyze and select best post
      console.log(`Analyzing ${posts.length} posts...`);
      const bestPost = postAnalyzer.selectBestPost(posts);

      if (!bestPost) {
        throw new OrchestrationError(
          'No valid posts found after analysis',
          'NO_VALID_POSTS'
        );
      }

      console.log(`Selected post: ${bestPost.post.title} (score: ${bestPost.totalScore.toFixed(2)})`);

      // Step 2: Save selected post to database
      console.log('Saving selected post to database...');
      let savedPost: SelectedPost;
      try {
        savedPost = await supabaseStorage.saveSelectedPost(bestPost.post, bestPost);
      } catch (error) {
        if (error instanceof StorageError && error.code === 'DUPLICATE_POST') {
          // Post already processed - check if audio exists
          const existingPost = await supabaseStorage.getSelectedPostByRedditId(bestPost.post.id);
          if (!existingPost) {
            throw new OrchestrationError(
              'Post marked as duplicate but not found in database',
              'POST_SAVE_FAILED',
              error
            );
          }
          if (existingPost.audio_file_id) {
            throw new OrchestrationError(
              'Post has already been processed with audio',
              'POST_ALREADY_PROCESSED',
              error
            );
          }
          // Audio doesn't exist yet, continue with this post
          savedPost = existingPost;
        } else {
          throw new OrchestrationError(
            'Failed to save selected post',
            'POST_SAVE_FAILED',
            error instanceof Error ? error : undefined
          );
        }
      }

      // Step 3: Generate audio using TTS service
      console.log('Generating audio with TTS...');
      let audioResult;
      try {
        audioResult = await ttsService.generateAudio(bestPost.post);
      } catch (error) {
        throw new OrchestrationError(
          'Failed to generate audio',
          'TTS_FAILED',
          error instanceof Error ? error : undefined
        );
      }

      console.log(`Audio generated using ${audioResult.provider} (${audioResult.sizeBytes} bytes)`);

      // Step 4: Upload audio to Supabase Storage
      console.log('Uploading audio to storage...');
      const fileName = this.generateAudioFileName(bestPost.post.id, audioResult.provider);

      let uploadResult;
      try {
        uploadResult = await supabaseStorage.uploadAudioFile(
          audioResult.audioBuffer,
          fileName,
          'audio/mpeg'
        );
      } catch (error) {
        throw new OrchestrationError(
          'Failed to upload audio file',
          'UPLOAD_FAILED',
          error instanceof Error ? error : undefined
        );
      }

      console.log(`Audio uploaded: ${uploadResult.publicUrl}`);

      // Step 5: Save audio file metadata
      console.log('Saving audio metadata...');
      let audioFile: AudioFile;
      try {
        audioFile = await supabaseStorage.saveAudioFile({
          fileUrl: uploadResult.publicUrl,
          durationSeconds: audioResult.duration,
          fileSizeBytes: uploadResult.fileSize,
          format: 'mp3',
          ttsProvider: audioResult.provider as 'elevenlabs' | 'inworld',
          voiceUsed: audioResult.voice
        });
      } catch (error) {
        throw new OrchestrationError(
          'Failed to save audio metadata',
          'METADATA_SAVE_FAILED',
          error instanceof Error ? error : undefined
        );
      }

      // Step 6: Link audio file to post
      console.log('Linking audio to post...');
      try {
        await supabaseStorage.linkAudioToPost(savedPost.id, audioFile.id);
      } catch (error) {
        throw new OrchestrationError(
          'Failed to link audio to post',
          'LINK_FAILED',
          error instanceof Error ? error : undefined
        );
      }

      console.log('Processing complete!');

      return {
        selectedPost: savedPost,
        audioFile,
        audioUrl: uploadResult.publicUrl,
        duration: audioResult.duration
      };
    } catch (error) {
      // Re-throw orchestration errors
      if (error instanceof OrchestrationError) {
        throw error;
      }

      // Wrap unexpected errors
      throw new OrchestrationError(
        `Unexpected error during processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNEXPECTED_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if a post has already been processed
   * @param redditPostId - Reddit post ID
   * @returns True if post exists with audio
   */
  async isPostProcessed(redditPostId: string): Promise<boolean> {
    try {
      const post = await supabaseStorage.getSelectedPostByRedditId(redditPostId);
      return post !== null && post.audio_file_id !== null;
    } catch (error) {
      console.error('Error checking post status:', error);
      return false;
    }
  }

  /**
   * Get TTS provider status
   * @returns Provider availability information
   */
  async getProviderStatus() {
    return await ttsService.getProvidersStatus();
  }
}

// Export singleton instance
export const postToAudioOrchestrator = new PostToAudioOrchestrator();
