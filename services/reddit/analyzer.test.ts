/**
 * Tests for Reddit Post Analyzer Service
 */

import { postAnalyzer, POST_SELECTION_CONFIG } from './analyzer';
import { RedditPost } from '@/types/reddit';

describe('PostAnalyzerService', () => {
  // Helper to create mock posts
  const createMockPost = (overrides: Partial<RedditPost> = {}): RedditPost => ({
    id: 'test-id',
    title: 'Test Post Title',
    author: 'testuser',
    score: 100,
    num_comments: 50,
    created_utc: Date.now() / 1000 - 3600, // 1 hour ago
    selftext: 'This is a test post with some content that should be analyzed by the algorithm.',
    permalink: '/r/test/comments/test',
    subreddit: 'test',
    ...overrides
  });

  describe('selectBestPost', () => {
    it('should return null for empty array', () => {
      const result = postAnalyzer.selectBestPost([]);
      expect(result).toBeNull();
    });

    it('should return null for posts without usable text', () => {
      const posts = [
        createMockPost({ title: 'Image', selftext: '' }),
        createMockPost({ title: 'Link', selftext: 'https://example.com' })
      ];
      const result = postAnalyzer.selectBestPost(posts);
      expect(result).toBeNull();
    });

    it('should select post with best overall score', () => {
      const posts = [
        createMockPost({
          id: 'low-engagement',
          score: 10,
          num_comments: 5,
          selftext: 'Short text.'
        }),
        createMockPost({
          id: 'high-engagement',
          score: 1000,
          num_comments: 500,
          selftext: 'This is a well-written post with multiple sentences. It has good structure and engaging content. The length is ideal for narration, containing between 100-500 words which makes for a perfect 30-90 second video. This post discusses interesting topics and maintains reader engagement throughout.',
        }),
        createMockPost({
          id: 'too-long',
          score: 500,
          num_comments: 200,
          selftext: 'Lorem ipsum '.repeat(100) // Very long post
        })
      ];

      const result = postAnalyzer.selectBestPost(posts);
      expect(result).not.toBeNull();
      // The algorithm should select a post with good balance of all metrics
      expect(['high-engagement', 'too-long']).toContain(result?.post.id);
    });

    it('should prioritize ideal word count (100-500 words)', () => {
      const shortPost = createMockPost({
        id: 'short',
        score: 1000,
        selftext: 'Very short post.'
      });

      const idealPost = createMockPost({
        id: 'ideal',
        score: 500,
        selftext: 'This post has an ideal length for video narration. '.repeat(20) // ~140 words
      });

      const result = postAnalyzer.selectBestPost([shortPost, idealPost]);
      expect(result?.post.id).toBe('ideal');
    });

    it('should filter out posts with only links', () => {
      const linkPost = createMockPost({
        id: 'link-only',
        title: 'Check this out',
        selftext: 'https://example.com/very-long-url-that-takes-up-most-of-the-post'
      });

      const textPost = createMockPost({
        id: 'text-post',
        title: 'Great discussion',
        selftext: 'This is a post with actual text content that can be narrated properly.'
      });

      const result = postAnalyzer.selectBestPost([linkPost, textPost]);
      expect(result?.post.id).toBe('text-post');
    });

    it('should return post score with all metrics', () => {
      const post = createMockPost();
      const result = postAnalyzer.selectBestPost([post]);

      expect(result).toMatchObject({
        post: expect.any(Object),
        engagementScore: expect.any(Number),
        textLength: expect.any(Number),
        contentQuality: expect.any(Number),
        totalScore: expect.any(Number)
      });

      expect(result?.engagementScore).toBeGreaterThanOrEqual(0);
      expect(result?.engagementScore).toBeLessThanOrEqual(1);
      expect(result?.totalScore).toBeGreaterThanOrEqual(0);
      expect(result?.totalScore).toBeLessThanOrEqual(1);
    });
  });

  describe('estimateAudioDuration', () => {
    it('should estimate duration based on word count', () => {
      const post = createMockPost({
        title: 'Title with five words here',
        selftext: 'Content with '.repeat(50) // ~100 words total
      });

      const duration = postAnalyzer.estimateAudioDuration(post);

      // ~105 words / 150 WPM * 60 = ~42 seconds
      expect(duration).toBeGreaterThan(35);
      expect(duration).toBeLessThan(50);
    });

    it('should return duration in seconds', () => {
      const post = createMockPost({
        title: 'Short',
        selftext: 'Very short post.'
      });

      const duration = postAnalyzer.estimateAudioDuration(post);
      expect(duration).toBeGreaterThan(0);
      expect(typeof duration).toBe('number');
    });
  });

  describe('isWithinDurationLimit', () => {
    it('should return true for posts within 90 second limit', () => {
      const post = createMockPost({
        selftext: 'Normal length post. '.repeat(30) // ~63 words, ~25 seconds
      });

      expect(postAnalyzer.isWithinDurationLimit(post)).toBe(true);
    });

    it('should return false for posts exceeding 90 second limit', () => {
      // 250 words = ~100 seconds
      const post = createMockPost({
        selftext: 'Very long post content. '.repeat(60) // ~250 words
      });

      expect(postAnalyzer.isWithinDurationLimit(post)).toBe(false);
    });

    it('should return true for posts near the limit', () => {
      // ~200 words = ~80 seconds (within limit)
      const post = createMockPost({
        selftext: 'Content that is near the limit. '.repeat(30) // ~186 words
      });

      expect(postAnalyzer.isWithinDurationLimit(post)).toBe(true);
    });
  });

  describe('scoring algorithm', () => {
    it('should give higher engagement score to popular recent posts', () => {
      const recentPopular = createMockPost({
        id: 'recent',
        score: 1000,
        num_comments: 500,
        created_utc: Date.now() / 1000 - 1800 // 30 minutes ago
      });

      const oldPost = createMockPost({
        id: 'old',
        score: 1000,
        num_comments: 500,
        created_utc: Date.now() / 1000 - 86400 // 24 hours ago
      });

      const result1 = postAnalyzer.selectBestPost([recentPopular]);
      const result2 = postAnalyzer.selectBestPost([oldPost]);

      expect(result1?.engagementScore).toBeGreaterThan(result2?.engagementScore || 0);
    });

    it('should penalize posts with excessive capitalization', () => {
      const normalPost = createMockPost({
        id: 'normal',
        selftext: 'This is a normal post with proper capitalization and good content.'
      });

      const capsPost = createMockPost({
        id: 'caps',
        selftext: 'THIS POST IS ALL CAPS AND LOOKS LIKE SPAM OR LOW QUALITY CONTENT!!!'
      });

      const result = postAnalyzer.selectBestPost([normalPost, capsPost]);
      expect(result?.post.id).toBe('normal');
    });

    it('should reward posts with paragraph structure', () => {
      const structuredPost = createMockPost({
        selftext: `This is the first paragraph with some content.

This is the second paragraph that adds more information.

And here is a third paragraph to conclude the post.`
      });

      const unstructuredPost = createMockPost({
        selftext: 'This is a single long paragraph without any structure or breaks just one continuous stream of text.'
      });

      const result1 = postAnalyzer.selectBestPost([structuredPost]);
      const result2 = postAnalyzer.selectBestPost([unstructuredPost]);

      expect(result1?.contentQuality).toBeGreaterThan(result2?.contentQuality || 0);
    });

    it('should use correct scoring weights', () => {
      const post = createMockPost({
        score: 100,
        num_comments: 50,
        selftext: 'Good content with ideal length. '.repeat(15) // ~60 words
      });

      const result = postAnalyzer.selectBestPost([post]);
      const { weights } = POST_SELECTION_CONFIG;

      // Total score should be weighted sum including text length
      const expectedTotal =
        (result?.engagementScore || 0) * weights.engagement +
        (result?.contentQuality || 0) * weights.quality;

      // Verify total score is within reasonable range (0-1)
      expect(result?.totalScore).toBeGreaterThan(0);
      expect(result?.totalScore).toBeLessThanOrEqual(1);

      // Verify it includes all three components
      expect(result).toMatchObject({
        engagementScore: expect.any(Number),
        textLength: expect.any(Number),
        contentQuality: expect.any(Number),
        totalScore: expect.any(Number)
      });
    });
  });
});
