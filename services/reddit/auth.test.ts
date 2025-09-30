/**
 * Tests for Reddit Authentication Service
 */

import { redditAuth, RedditAuthError } from './auth';
import testFixtures from '@/tests/fixtures/reddit-posts.json';

// Use the global fetch mock from jest.setup.js
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('RedditAuthService', () => {
  beforeEach(() => {
    // Reset token cache before each test
    redditAuth.clearTokenCache();
    mockFetch.mockClear();
  });

  describe('getAccessToken', () => {
    it('should fetch new token from Reddit API', async () => {
      // Mock successful token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(testFixtures.mockTokenResponse),
        text: () => Promise.resolve(''),
        headers: new Headers(),
        url: '',
        type: 'basic',
        redirected: false,
        bodyUsed: false,
        body: null,
        clone: () => ({} as Response),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
      } as Response);

      const token = await redditAuth.getAccessToken();

      expect(token).toBe('test_access_token_123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.reddit.com/api/v1/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic'),
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'test_app:1.0.0 (by /u/testuser)',
          }),
          body: 'grant_type=client_credentials',
        })
      );
    });

    it('should return cached token if still valid', async () => {
      // Mock initial token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(testFixtures.mockTokenResponse),
      } as Response);

      // First call - should fetch token
      const token1 = await redditAuth.getAccessToken();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cached token
      const token2 = await redditAuth.getAccessToken();
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional call
      expect(token1).toBe(token2);
    });

    it('should throw RedditAuthError on API failure', async () => {
      // Mock failed response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({}),
      } as Response);

      await expect(redditAuth.getAccessToken()).rejects.toThrow(RedditAuthError);
      await expect(redditAuth.getAccessToken()).rejects.toThrow('Authentication failed: 401 Unauthorized');
    });

    it('should throw RedditAuthError on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      await expect(redditAuth.getAccessToken()).rejects.toThrow(RedditAuthError);
      await expect(redditAuth.getAccessToken()).rejects.toThrow('Network error during authentication');
    });
  });

  describe('getAuthenticatedHeaders', () => {
    it('should return headers with Bearer token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testFixtures.mockTokenResponse),
      } as Response);

      const headers = await redditAuth.getAuthenticatedHeaders();

      expect(headers).toEqual({
        'Authorization': 'Bearer test_access_token_123',
        'User-Agent': 'test_app:1.0.0 (by /u/testuser)',
        'Content-Type': 'application/json',
      });
    });
  });

  describe('hasValidCredentials', () => {
    it('should return true when all credentials are available', () => {
      expect(redditAuth.hasValidCredentials()).toBe(true);
    });
  });
});