/**
 * Tests for Post-to-Audio Orchestration Service
 */

import { RedditPost } from '@/types/reddit';
import { SelectedPost, AudioFile } from '@/types/database';

// Mock dependencies BEFORE imports
jest.mock('@/services/reddit/analyzer');
jest.mock('@/services/tts', () => ({
  ttsService: {
    generateAudio: jest.fn(),
    getProvidersStatus: jest.fn()
  },
  TTSServiceError: class TTSServiceError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'TTSServiceError';
    }
  }
}));
jest.mock('@/services/storage/supabase', () => {
  class StorageError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'StorageError';
    }
  }

  return {
    supabaseStorage: {
      saveSelectedPost: jest.fn(),
      saveAudioFile: jest.fn(),
      uploadAudioFile: jest.fn(),
      linkAudioToPost: jest.fn(),
      getSelectedPostByRedditId: jest.fn(),
      cleanupOldAudioFiles: jest.fn()
    },
    StorageError
  };
});

import { postToAudioOrchestrator, OrchestrationError } from './post-to-audio';
import { postAnalyzer } from '@/services/reddit/analyzer';
import { ttsService } from '@/services/tts';
import { supabaseStorage, StorageError } from '@/services/storage/supabase';

describe('PostToAudioOrchestrator', () => {
  // Test data
  const mockRedditPost: RedditPost = {
    id: 'test123',
    title: 'Test Post Title',
    selftext: 'This is test content for the post. '.repeat(20), // ~100 words
    author: 'testuser',
    score: 500,
    num_comments: 50,
    created_utc: Date.now() / 1000,
    permalink: '/r/test/comments/test123',
    subreddit: 'test'
  };

  const mockPostScore = {
    post: mockRedditPost,
    engagementScore: 150,
    textLength: 100,
    contentQuality: 0.8,
    totalScore: 85
  };

  const mockSelectedPost: SelectedPost = {
    id: 'post-uuid',
    reddit_post_id: 'test123',
    subreddit: 'test',
    title: 'Test Post Title',
    selftext: mockRedditPost.selftext,
    score: 500,
    num_comments: 50,
    author: 'testuser',
    created_utc: new Date().toISOString(),
    selection_score: 85,
    audio_file_id: null,
    created_at: new Date().toISOString()
  };

  const mockAudioResult = {
    audioBuffer: Buffer.from('mock audio data'),
    provider: 'elevenlabs',
    voice: 'rachel',
    duration: 45,
    sizeBytes: 50000
  };

  const mockUploadResult = {
    audioFileId: 'audio-path',
    publicUrl: 'https://example.com/audio.mp3',
    fileSize: 50000
  };

  const mockAudioFile: AudioFile = {
    id: 'audio-uuid',
    file_url: 'https://example.com/audio.mp3',
    duration_seconds: 45,
    file_size_bytes: 50000,
    format: 'mp3',
    tts_provider: 'elevenlabs',
    voice_used: 'rachel',
    created_at: new Date().toISOString()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks - use mockImplementation to reset properly
    (postAnalyzer.selectBestPost as jest.Mock).mockImplementation(() => mockPostScore);
    (ttsService.generateAudio as jest.Mock).mockImplementation(() => Promise.resolve(mockAudioResult));
    (supabaseStorage.saveSelectedPost as jest.Mock).mockImplementation(() => Promise.resolve(mockSelectedPost));
    (supabaseStorage.uploadAudioFile as jest.Mock).mockImplementation(() => Promise.resolve(mockUploadResult));
    (supabaseStorage.saveAudioFile as jest.Mock).mockImplementation(() => Promise.resolve(mockAudioFile));
    (supabaseStorage.linkAudioToPost as jest.Mock).mockImplementation(() => Promise.resolve(undefined));
    (supabaseStorage.getSelectedPostByRedditId as jest.Mock).mockImplementation(() => Promise.resolve(null));
  });

  describe('processPostToAudio', () => {
    afterEach(() => {
      // Ensure mocks are reset after each test
      (supabaseStorage.saveSelectedPost as jest.Mock).mockImplementation(() => Promise.resolve(mockSelectedPost));
      (supabaseStorage.getSelectedPostByRedditId as jest.Mock).mockImplementation(() => Promise.resolve(null));
    });

    it('should complete full workflow successfully', async () => {
      const result = await postToAudioOrchestrator.processPostToAudio([mockRedditPost]);

      expect(result).toEqual({
        selectedPost: mockSelectedPost,
        audioFile: mockAudioFile,
        audioUrl: mockUploadResult.publicUrl,
        duration: mockAudioResult.duration
      });

      // Verify all steps were called
      expect(postAnalyzer.selectBestPost).toHaveBeenCalledWith([mockRedditPost]);
      expect(supabaseStorage.saveSelectedPost).toHaveBeenCalledWith(mockRedditPost, mockPostScore);
      expect(ttsService.generateAudio).toHaveBeenCalledWith(mockRedditPost);
      expect(supabaseStorage.uploadAudioFile).toHaveBeenCalledWith(
        mockAudioResult.audioBuffer,
        expect.stringContaining('test123_elevenlabs'),
        'audio/mpeg'
      );
      expect(supabaseStorage.saveAudioFile).toHaveBeenCalled();
      expect(supabaseStorage.linkAudioToPost).toHaveBeenCalledWith('post-uuid', 'audio-uuid');
    });

    it('should throw error if posts array is empty', async () => {
      await expect(postToAudioOrchestrator.processPostToAudio([])).rejects.toThrow(
        OrchestrationError
      );
      await expect(postToAudioOrchestrator.processPostToAudio([])).rejects.toMatchObject({
        code: 'EMPTY_POSTS_ARRAY'
      });
    });

    it('should throw error if no valid posts after analysis', async () => {
      (postAnalyzer.selectBestPost as jest.Mock).mockReturnValue(null);

      await expect(postToAudioOrchestrator.processPostToAudio([mockRedditPost])).rejects.toThrow(
        OrchestrationError
      );
      await expect(
        postToAudioOrchestrator.processPostToAudio([mockRedditPost])
      ).rejects.toMatchObject({
        code: 'NO_VALID_POSTS'
      });
    });

    it('should handle duplicate post scenarios correctly', async () => {
      const duplicateError = new StorageError('Duplicate post', 'DUPLICATE_POST');

      // Scenario 1: Duplicate without audio - should continue
      const existingPostWithoutAudio = {
        ...mockSelectedPost,
        audio_file_id: null
      };

      (supabaseStorage.saveSelectedPost as jest.Mock).mockRejectedValueOnce(duplicateError);
      (supabaseStorage.getSelectedPostByRedditId as jest.Mock).mockResolvedValueOnce(existingPostWithoutAudio);

      let result = await postToAudioOrchestrator.processPostToAudio([mockRedditPost]);

      expect(result.selectedPost).toBeDefined();
      expect(result.selectedPost).toEqual(existingPostWithoutAudio);

      // Scenario 2: Duplicate with audio - should throw
      const existingPostWithAudio = {
        ...mockSelectedPost,
        audio_file_id: 'existing-audio-uuid'
      };

      (supabaseStorage.saveSelectedPost as jest.Mock).mockRejectedValue(duplicateError);
      (supabaseStorage.getSelectedPostByRedditId as jest.Mock).mockResolvedValue(existingPostWithAudio);

      await expect(postToAudioOrchestrator.processPostToAudio([mockRedditPost])).rejects.toMatchObject({
        code: 'POST_ALREADY_PROCESSED'
      });
    });

    it('should throw error if post save fails', async () => {
      (supabaseStorage.saveSelectedPost as jest.Mock).mockRejectedValue(
        new StorageError('Database error', 'DB_ERROR')
      );

      await expect(postToAudioOrchestrator.processPostToAudio([mockRedditPost])).rejects.toThrow(
        OrchestrationError
      );

      // Reset and test again
      (supabaseStorage.saveSelectedPost as jest.Mock).mockRejectedValue(
        new StorageError('Database error', 'DB_ERROR')
      );

      await expect(
        postToAudioOrchestrator.processPostToAudio([mockRedditPost])
      ).rejects.toMatchObject({
        code: 'POST_SAVE_FAILED'
      });
    });

    it('should throw error if TTS generation fails', async () => {
      (ttsService.generateAudio as jest.Mock).mockRejectedValue(new Error('TTS failed'));

      await expect(postToAudioOrchestrator.processPostToAudio([mockRedditPost])).rejects.toThrow(
        OrchestrationError
      );

      (ttsService.generateAudio as jest.Mock).mockRejectedValue(new Error('TTS failed'));

      await expect(
        postToAudioOrchestrator.processPostToAudio([mockRedditPost])
      ).rejects.toMatchObject({
        code: 'TTS_FAILED'
      });
    });

    it('should throw error if audio upload fails', async () => {
      (supabaseStorage.uploadAudioFile as jest.Mock).mockRejectedValue(
        new StorageError('Upload failed', 'UPLOAD_ERROR')
      );

      await expect(postToAudioOrchestrator.processPostToAudio([mockRedditPost])).rejects.toThrow(
        OrchestrationError
      );

      (supabaseStorage.uploadAudioFile as jest.Mock).mockRejectedValue(
        new StorageError('Upload failed', 'UPLOAD_ERROR')
      );

      await expect(
        postToAudioOrchestrator.processPostToAudio([mockRedditPost])
      ).rejects.toMatchObject({
        code: 'UPLOAD_FAILED'
      });
    });

    it('should throw error if metadata save fails', async () => {
      (supabaseStorage.saveAudioFile as jest.Mock).mockRejectedValue(
        new StorageError('Metadata save failed', 'DB_ERROR')
      );

      await expect(postToAudioOrchestrator.processPostToAudio([mockRedditPost])).rejects.toThrow(
        OrchestrationError
      );

      (supabaseStorage.saveAudioFile as jest.Mock).mockRejectedValue(
        new StorageError('Metadata save failed', 'DB_ERROR')
      );

      await expect(
        postToAudioOrchestrator.processPostToAudio([mockRedditPost])
      ).rejects.toMatchObject({
        code: 'METADATA_SAVE_FAILED'
      });
    });

    it('should throw error if linking audio to post fails', async () => {
      (supabaseStorage.linkAudioToPost as jest.Mock).mockRejectedValue(
        new StorageError('Link failed', 'DB_ERROR')
      );

      await expect(postToAudioOrchestrator.processPostToAudio([mockRedditPost])).rejects.toThrow(
        OrchestrationError
      );

      (supabaseStorage.linkAudioToPost as jest.Mock).mockRejectedValue(
        new StorageError('Link failed', 'DB_ERROR')
      );

      await expect(
        postToAudioOrchestrator.processPostToAudio([mockRedditPost])
      ).rejects.toMatchObject({
        code: 'LINK_FAILED'
      });
    });

    it('should generate unique filename with post ID and provider', async () => {
      await postToAudioOrchestrator.processPostToAudio([mockRedditPost]);

      expect(supabaseStorage.uploadAudioFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringMatching(/^test123_elevenlabs_\d+\.mp3$/),
        'audio/mpeg'
      );
    });
  });

  describe('isPostProcessed', () => {
    beforeEach(() => {
      // Completely reset implementation for these tests
      jest.clearAllMocks();
      (postAnalyzer.selectBestPost as jest.Mock).mockImplementation(() => mockPostScore);
      (ttsService.generateAudio as jest.Mock).mockImplementation(() => Promise.resolve(mockAudioResult));
      (ttsService.getProvidersStatus as jest.Mock).mockImplementation(() => Promise.resolve([]));
      (supabaseStorage.saveSelectedPost as jest.Mock).mockImplementation(() => Promise.resolve(mockSelectedPost));
      (supabaseStorage.uploadAudioFile as jest.Mock).mockImplementation(() => Promise.resolve(mockUploadResult));
      (supabaseStorage.saveAudioFile as jest.Mock).mockImplementation(() => Promise.resolve(mockAudioFile));
      (supabaseStorage.linkAudioToPost as jest.Mock).mockImplementation(() => Promise.resolve(undefined));
    });

    it('should check post processing status correctly', async () => {
      // Test 1: Return true if post exists with audio
      (supabaseStorage.getSelectedPostByRedditId as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ...mockSelectedPost,
          audio_file_id: 'audio-uuid'
        })
      );

      let result = await postToAudioOrchestrator.isPostProcessed('test123');
      expect(result).toBe(true);

      // Test 2: Return false if post exists without audio
      (supabaseStorage.getSelectedPostByRedditId as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ...mockSelectedPost,
          audio_file_id: null
        })
      );

      result = await postToAudioOrchestrator.isPostProcessed('test123');
      expect(result).toBe(false);

      // Test 3: Return false if post does not exist
      (supabaseStorage.getSelectedPostByRedditId as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve(null)
      );

      result = await postToAudioOrchestrator.isPostProcessed('test123');
      expect(result).toBe(false);

      // Test 4: Return false on error
      (supabaseStorage.getSelectedPostByRedditId as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Database error'))
      );

      result = await postToAudioOrchestrator.isPostProcessed('test123');
      expect(result).toBe(false);
    });
  });

  describe('getProviderStatus', () => {
    it('should return provider status from TTS service', async () => {
      const mockStatus = [
        { name: 'elevenlabs', available: true, quota: 1000 },
        { name: 'inworld', available: true, quota: 500 }
      ];

      (ttsService.getProvidersStatus as jest.Mock).mockResolvedValueOnce(mockStatus);

      const result = await postToAudioOrchestrator.getProviderStatus();

      expect(result).toEqual(mockStatus);
      expect(ttsService.getProvidersStatus).toHaveBeenCalled();
    });
  });
});
