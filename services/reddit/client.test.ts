/**
 * Tests for Reddit Client Service
 */

import { redditClient, RedditAPIError } from './client';
import { redditAuth } from './auth';
import testFixtures from '@/tests/fixtures/reddit-posts.json';

// Mock the auth service
jest.mock('./auth');
const mockRedditAuth = redditAuth as jest.Mocked<typeof redditAuth>;

// Use the global fetch mock from jest.setup.js
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('RedditClientService', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockRedditAuth.getAuthenticatedHeaders.mockClear();

    // Default mock for auth headers
    mockRedditAuth.getAuthenticatedHeaders.mockResolvedValue({
      'Authorization': 'Bearer test_token',
      'User-Agent': 'test_app:1.0.0 (by /u/testuser)',
      'Content-Type': 'application/json',
    });
  });

  describe('fetchTopPosts', () => {
    it('should fetch and transform posts successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testFixtures.mockRedditApiResponse),
      } as Response);

      const posts = await redditClient.fetchTopPosts('technology', 10);

      expect(posts).toHaveLength(3);
      expect(posts[0]).toEqual({
        id: 'abc123',
        title: 'Test Post 1: Amazing Technology Discovery',
        author: 'testuser1',
        score: 1500,
        num_comments: 250,
        created_utc: 1700000000,
        selftext: 'This is a test post with some content about technology. It has enough text to be interesting for testing purposes.',
        permalink: '/r/technology/comments/abc123/test_post_1_amazing_technology_discovery/',
        subreddit: 'technology',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth.reddit.com/r/technology/hot.json?limit=10',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_token',
          }),
        })
      );
    });

    it('should sanitize subreddit names correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { children: [] } }),
      } as Response);

      // Test various subreddit name formats
      await redditClient.fetchTopPosts('/r/Technology', 5);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth.reddit.com/r/technology/hot.json?limit=5',
        expect.any(Object)
      );
    });

    it('should enforce limit constraints', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: { children: [] } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: { children: [] } }),
        } as Response);

      // Test limit boundaries
      await redditClient.fetchTopPosts('test', 0); // Should become 1
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=1'),
        expect.any(Object)
      );

      await redditClient.fetchTopPosts('test', 50); // Should become 25
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=25'),
        expect.any(Object)
      );
    });

    it('should handle invalid subreddit format', async () => {
      await expect(redditClient.fetchTopPosts('a', 10)).rejects.toThrow(RedditAPIError);
      await expect(redditClient.fetchTopPosts('a', 10)).rejects.toThrow('Invalid subreddit name format');
    });

    it('should handle 404 subreddit not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({}),
      } as Response);

      await expect(redditClient.fetchTopPosts('nonexistent', 10)).rejects.toThrow(RedditAPIError);
      await expect(redditClient.fetchTopPosts('nonexistent', 10)).rejects.toThrow('Subreddit not found or is private');
    });

    it('should handle 403 private subreddit', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({}),
      } as Response);

      await expect(redditClient.fetchTopPosts('private', 10)).rejects.toThrow(RedditAPIError);
      await expect(redditClient.fetchTopPosts('private', 10)).rejects.toThrow('Access forbidden');
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.resolve({}),
      } as Response);

      await expect(redditClient.fetchTopPosts('test', 10)).rejects.toThrow(RedditAPIError);
      await expect(redditClient.fetchTopPosts('test', 10)).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      await expect(redditClient.fetchTopPosts('test', 10)).rejects.toThrow(RedditAPIError);
      await expect(redditClient.fetchTopPosts('test', 10)).rejects.toThrow('Network error');
    });

    it('should handle malformed API response', async () => {
      mockFetch.mockClear();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ invalid: 'response' }),
      } as Response);

      await expect(redditClient.fetchTopPosts('test', 10)).rejects.toThrow(RedditAPIError);
      await expect(redditClient.fetchTopPosts('test', 10)).rejects.toThrow('Invalid response format');
    });

    it('should filter out non-post entries', async () => {
      const responseWithMixedTypes = {
        data: {
          children: [
            { kind: 't3', data: testFixtures.mockRedditApiResponse.data.children[0].data },
            { kind: 't1', data: { /* comment data */ } }, // Should be filtered out
            { kind: 't3', data: testFixtures.mockRedditApiResponse.data.children[1].data },
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responseWithMixedTypes),
      } as Response);

      const posts = await redditClient.fetchTopPosts('test', 10);
      expect(posts).toHaveLength(2); // Only t3 (posts) should be included
    });

    it('should handle empty selftext correctly', async () => {
      const postWithEmptySelftext = {
        data: {
          children: [{
            kind: 't3',
            data: {
              ...testFixtures.mockRedditApiResponse.data.children[0].data,
              selftext: null // Reddit API sometimes returns null
            }
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(postWithEmptySelftext),
      } as Response);

      const posts = await redditClient.fetchTopPosts('test', 1);
      expect(posts[0].selftext).toBe(''); // Should convert null to empty string
    });
  });

  describe('validateSubreddit', () => {
    it('should validate existing public subreddit', async () => {
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { display_name: 'technology' } }),
      } as Response);

      const result = await redditClient.validateSubreddit('technology');
      expect(result).toEqual({
        isValid: true,
        exists: true,
        isPublic: true
      });
    });

    it('should handle non-existent subreddit', async () => {
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({}),
      } as Response);

      const result = await redditClient.validateSubreddit('nonexistent');
      expect(result.exists).toBe(false);
      expect(result.isPublic).toBe(false);
    });

    it('should handle private subreddit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({}),
      } as Response);

      const result = await redditClient.validateSubreddit('private');
      expect(result.exists).toBe(true);
      expect(result.isPublic).toBe(false);
    });

    it('should reject invalid subreddit formats', async () => {
      const result = await redditClient.validateSubreddit('a'); // Too short
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Invalid subreddit name format');
    });
  });

  describe('fetchPosts (extended API)', () => {
    it('should handle pagination parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: {
            children: [],
            after: 'test_after',
            before: 'test_before'
          }
        }),
      } as Response);

      const result = await redditClient.fetchPosts({
        subreddit: 'test',
        limit: 5,
        sort: 'new',
        after: 'prev_after'
      });

      expect(result.after).toBe('test_after');
      expect(result.before).toBe('test_before');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('new.json?limit=5&after=prev_after'),
        expect.any(Object)
      );
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return rate limit information', () => {
      const status = redditClient.getRateLimitStatus();
      expect(status).toHaveProperty('canMakeRequest');
      expect(status).toHaveProperty('timeUntilReset');
      expect(typeof status.canMakeRequest).toBe('boolean');
      expect(typeof status.timeUntilReset).toBe('number');
    });
  });
});