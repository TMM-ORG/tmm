/**
 * Tests for Supabase Storage Service
 */

import { supabaseStorage, StorageError } from './supabase';
import { createServerClient } from '@/lib/supabase';
import { RedditPost } from '@/types/reddit';
import { PostScore } from '@/services/reddit/analyzer';

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
  createServerClient: jest.fn()
}));

describe('SupabaseStorageService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Supabase client
    mockSupabase = {
      from: jest.fn(),
      storage: {
        from: jest.fn()
      }
    };

    (createServerClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  // Helper to create mock post
  const createMockPost = (overrides: Partial<RedditPost> = {}): RedditPost => ({
    id: 'test-post-id',
    title: 'Test Post',
    author: 'testuser',
    score: 100,
    num_comments: 50,
    created_utc: Date.now() / 1000,
    selftext: 'Test content',
    permalink: '/r/test/comments/test',
    subreddit: 'test',
    ...overrides
  });

  const createMockScore = (): PostScore => ({
    post: createMockPost(),
    engagementScore: 0.7,
    textLength: 50,
    contentQuality: 0.8,
    totalScore: 0.75
  });

  describe('saveSelectedPost', () => {
    it('should save selected post successfully', async () => {
      const mockPost = createMockPost();
      const mockScore = createMockScore();
      const mockDbResponse = {
        id: 'uuid-123',
        reddit_post_id: mockPost.id,
        subreddit: mockPost.subreddit,
        title: mockPost.title,
        selftext: mockPost.selftext,
        score: mockPost.score,
        num_comments: mockPost.num_comments,
        author: mockPost.author,
        created_utc: new Date(mockPost.created_utc * 1000).toISOString(),
        selection_score: mockScore.totalScore,
        audio_file_id: null,
        created_at: new Date().toISOString()
      };

      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockDbResponse, error: null })
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await supabaseStorage.saveSelectedPost(mockPost, mockScore);

      expect(mockSupabase.from).toHaveBeenCalledWith('selected_posts');
      expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
        reddit_post_id: mockPost.id,
        subreddit: mockPost.subreddit,
        selection_score: mockScore.totalScore
      }));
      expect(result).toEqual(mockDbResponse);
    });

    it('should throw error for duplicate post', async () => {
      const mockPost = createMockPost();
      const mockScore = createMockScore();

      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'Duplicate key' }
        })
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(
        supabaseStorage.saveSelectedPost(mockPost, mockScore)
      ).rejects.toThrow(StorageError);

      await expect(
        supabaseStorage.saveSelectedPost(mockPost, mockScore)
      ).rejects.toThrow('already been selected');
    });

    it('should handle database errors', async () => {
      const mockPost = createMockPost();
      const mockScore = createMockScore();

      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(
        supabaseStorage.saveSelectedPost(mockPost, mockScore)
      ).rejects.toThrow(StorageError);
    });
  });

  describe('saveAudioFile', () => {
    it('should save audio file metadata successfully', async () => {
      const audioData = {
        fileUrl: 'https://example.com/audio.mp3',
        durationSeconds: 45.5,
        fileSizeBytes: 1024000,
        format: 'mp3',
        ttsProvider: 'elevenlabs' as const,
        voiceUsed: 'rachel'
      };

      const mockDbResponse = {
        id: 'audio-uuid-123',
        ...audioData,
        file_url: audioData.fileUrl,
        duration_seconds: audioData.durationSeconds,
        file_size_bytes: audioData.fileSizeBytes,
        tts_provider: audioData.ttsProvider,
        voice_used: audioData.voiceUsed,
        created_at: new Date().toISOString()
      };

      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockDbResponse, error: null })
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await supabaseStorage.saveAudioFile(audioData);

      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
        file_url: audioData.fileUrl,
        duration_seconds: audioData.durationSeconds,
        tts_provider: audioData.ttsProvider
      }));
      expect(result.id).toBe('audio-uuid-123');
    });
  });

  describe('linkAudioToPost', () => {
    it('should link audio file to post successfully', async () => {
      const mockChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await supabaseStorage.linkAudioToPost('post-uuid', 'audio-uuid');

      expect(mockSupabase.from).toHaveBeenCalledWith('selected_posts');
      expect(mockChain.update).toHaveBeenCalledWith({ audio_file_id: 'audio-uuid' });
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'post-uuid');
    });
  });

  describe('uploadAudioFile', () => {
    it('should upload audio file and return public URL', async () => {
      const audioBuffer = Buffer.from('fake audio data');
      const fileName = 'test-audio.mp3';

      const mockStorageChain = {
        upload: jest.fn().mockResolvedValue({
          data: { path: fileName },
          error: null
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: `https://storage.example.com/${fileName}` }
        })
      };

      mockSupabase.storage.from.mockReturnValue(mockStorageChain);

      const result = await supabaseStorage.uploadAudioFile(audioBuffer, fileName);

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('audio_files');
      expect(mockStorageChain.upload).toHaveBeenCalledWith(
        fileName,
        audioBuffer,
        expect.objectContaining({
          contentType: 'audio/mpeg',
          upsert: false
        })
      );
      expect(result).toEqual({
        audioFileId: fileName,
        publicUrl: expect.stringContaining(fileName),
        fileSize: audioBuffer.length
      });
    });

    it('should handle upload errors', async () => {
      const audioBuffer = Buffer.from('fake audio data');
      const fileName = 'test-audio.mp3';

      const mockStorageChain = {
        upload: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Upload failed' }
        })
      };

      mockSupabase.storage.from.mockReturnValue(mockStorageChain);

      await expect(
        supabaseStorage.uploadAudioFile(audioBuffer, fileName)
      ).rejects.toThrow(StorageError);
    });
  });

  describe('getSelectedPostByRedditId', () => {
    it('should return post if found', async () => {
      const mockPost = {
        id: 'uuid-123',
        reddit_post_id: 'test-id',
        subreddit: 'test',
        title: 'Test Post',
        selftext: 'Content',
        score: 100,
        num_comments: 50,
        author: 'testuser',
        created_utc: new Date().toISOString(),
        selection_score: 0.75,
        audio_file_id: null,
        created_at: new Date().toISOString()
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPost, error: null })
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await supabaseStorage.getSelectedPostByRedditId('test-id');

      expect(mockSupabase.from).toHaveBeenCalledWith('selected_posts');
      expect(mockChain.eq).toHaveBeenCalledWith('reddit_post_id', 'test-id');
      expect(result).toEqual(mockPost);
    });

    it('should return null if post not found', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await supabaseStorage.getSelectedPostByRedditId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('cleanupOldAudioFiles', () => {
    it('should delete old audio files', async () => {
      const oldFiles = [
        { id: '1', file_url: 'https://example.com/old1.mp3' },
        { id: '2', file_url: 'https://example.com/old2.mp3' }
      ];

      const mockSelectChain = {
        select: jest.fn().mockReturnThis(),
        lt: jest.fn().mockResolvedValue({ data: oldFiles, error: null })
      };

      const mockDeleteChain = {
        delete: jest.fn().mockReturnThis(),
        lt: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSelectChain)
        .mockReturnValueOnce(mockDeleteChain);

      const mockStorageChain = {
        remove: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      mockSupabase.storage.from.mockReturnValue(mockStorageChain);

      const result = await supabaseStorage.cleanupOldAudioFiles(30);

      expect(result).toBe(2);
      expect(mockStorageChain.remove).toHaveBeenCalledWith(['old1.mp3', 'old2.mp3']);
    });

    it('should return 0 if no old files found', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        lt: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await supabaseStorage.cleanupOldAudioFiles(30);

      expect(result).toBe(0);
    });
  });
});
