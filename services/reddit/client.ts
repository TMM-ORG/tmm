/**
 * Reddit API Client Service
 * Handles fetching posts from Reddit with error handling and rate limiting
 */

import { redditAuth, RedditAuthError } from './auth';
import {
  RedditPost,
  RedditApiResponse,
  FetchPostsParams,
  RedditServiceResponse,
  SubredditValidation
} from '@/types/reddit';

// Custom error for Reddit API failures
export class RedditAPIError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'RedditAPIError';
  }
}

// Rate limiting helper
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 60; // Reddit limit: 60 requests per minute
  private readonly windowMs = 60 * 1000; // 1 minute

  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove requests older than 1 minute
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getTimeUntilReset(): number {
    if (this.requests.length === 0) return 0;
    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
  }
}

class RedditClientService {
  private baseUrl = 'https://oauth.reddit.com';
  private rateLimiter = new RateLimiter();

  /**
   * Validate subreddit name format
   * @param subreddit - The subreddit name to validate
   * @returns boolean indicating if format is valid
   */
  private validateSubredditFormat(subreddit: string): boolean {
    // Reddit subreddit rules: 3-21 chars, letters/numbers/underscores only
    const pattern = /^[a-zA-Z0-9_]{3,21}$/;
    return pattern.test(subreddit);
  }

  /**
   * Sanitize subreddit name
   * @param subreddit - Raw subreddit input
   * @returns Sanitized subreddit name
   */
  private sanitizeSubreddit(subreddit: string): string {
    return subreddit
      .toLowerCase()
      .replace(/^\/?(r\/)?/, '') // Remove /r/ prefix if present
      .replace(/[^a-z0-9_]/g, '') // Remove invalid characters
      .substring(0, 21); // Limit length
  }

  /**
   * Make authenticated request to Reddit API with rate limiting
   * @param endpoint - API endpoint to call
   * @returns Promise resolving to response data
   */
  private async makeRequest<T>(endpoint: string): Promise<T> {
    // Check rate limit
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getTimeUntilReset();
      throw new RedditAPIError(
        `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`,
        429
      );
    }

    try {
      const headers = await redditAuth.getAuthenticatedHeaders();

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
      });

      // Record request for rate limiting (even failed ones count towards limit)
      this.rateLimiter.recordRequest();

      if (!response.ok) {
        if (response.status === 404) {
          throw new RedditAPIError('Subreddit not found or is private', 404);
        }
        if (response.status === 403) {
          throw new RedditAPIError('Access forbidden - subreddit may be private or banned', 403);
        }
        if (response.status === 429) {
          throw new RedditAPIError('Rate limit exceeded', 429);
        }

        throw new RedditAPIError(
          `Reddit API error: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof RedditAPIError || error instanceof RedditAuthError) {
        throw error;
      }

      throw new RedditAPIError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Convert Reddit API post data to our simplified format
   * @param apiPost - Raw post data from Reddit API
   * @returns Simplified RedditPost object
   */
  private transformPost(apiPost: any): RedditPost {
    return {
      id: apiPost.id,
      title: apiPost.title,
      author: apiPost.author,
      score: apiPost.score,
      num_comments: apiPost.num_comments,
      created_utc: apiPost.created_utc,
      selftext: apiPost.selftext || '',
      permalink: apiPost.permalink,
      subreddit: apiPost.subreddit,
    };
  }

  /**
   * Validate if a subreddit exists and is accessible
   * @param subreddit - The subreddit name to validate
   * @returns Promise resolving to validation result
   */
  async validateSubreddit(subreddit: string): Promise<SubredditValidation> {
    const sanitized = this.sanitizeSubreddit(subreddit);

    if (!this.validateSubredditFormat(sanitized)) {
      return {
        isValid: false,
        exists: false,
        isPublic: false,
        reason: 'Invalid subreddit name format'
      };
    }

    try {
      await this.makeRequest(`/r/${sanitized}/about.json`);
      return {
        isValid: true,
        exists: true,
        isPublic: true
      };
    } catch (error) {
      if (error instanceof RedditAPIError) {
        return {
          isValid: true,
          exists: error.statusCode !== 404,
          isPublic: error.statusCode !== 403 && error.statusCode !== 404,
          reason: error.message
        };
      }

      return {
        isValid: false,
        exists: false,
        isPublic: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch top posts from a subreddit
   * @param subreddit - The subreddit name (without /r/ prefix)
   * @param limit - Number of posts to fetch (default: 10, max: 25 for this MVP)
   * @returns Promise resolving to array of Reddit posts
   * @throws RedditAPIError when API request fails
   * @throws RedditAuthError when authentication fails
   */
  async fetchTopPosts(subreddit: string, limit: number = 10): Promise<RedditPost[]> {
    // Validate and sanitize input
    const sanitized = this.sanitizeSubreddit(subreddit);

    if (!this.validateSubredditFormat(sanitized)) {
      throw new RedditAPIError('Invalid subreddit name format', 400);
    }

    // Limit the number of posts (MVP constraint)
    const requestLimit = Math.min(Math.max(1, limit), 25);

    try {
      // Fetch hot posts from the subreddit
      const data: RedditApiResponse = await this.makeRequest(
        `/r/${sanitized}/hot.json?limit=${requestLimit}`
      );

      // Validate response structure
      if (!data.data || !Array.isArray(data.data.children)) {
        throw new RedditAPIError('Invalid response format from Reddit API', 500);
      }

      // Transform and filter posts
      const posts = data.data.children
        .filter(child => child.kind === 't3') // Only posts (not comments)
        .map(child => this.transformPost(child.data))
        .slice(0, requestLimit); // Ensure we don't exceed requested limit

      return posts;
    } catch (error) {
      if (error instanceof RedditAPIError || error instanceof RedditAuthError) {
        throw error;
      }

      throw new RedditAPIError(
        `Failed to fetch posts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Fetch posts with additional parameters (for future extensibility)
   * @param params - Parameters for fetching posts
   * @returns Promise resolving to service response with posts and pagination
   */
  async fetchPosts(params: FetchPostsParams): Promise<RedditServiceResponse> {
    const { subreddit, limit = 10, sort = 'hot', after, before } = params;

    const sanitized = this.sanitizeSubreddit(subreddit);
    const requestLimit = Math.min(Math.max(1, limit), 25);

    // Build query parameters
    const queryParams = new URLSearchParams({
      limit: requestLimit.toString(),
    });

    if (after) queryParams.append('after', after);
    if (before) queryParams.append('before', before);

    try {
      const data: RedditApiResponse = await this.makeRequest(
        `/r/${sanitized}/${sort}.json?${queryParams.toString()}`
      );

      const posts = data.data.children
        .filter(child => child.kind === 't3')
        .map(child => this.transformPost(child.data))
        .slice(0, requestLimit);

      return {
        posts,
        after: data.data.after,
        before: data.data.before,
      };
    } catch (error) {
      if (error instanceof RedditAPIError || error instanceof RedditAuthError) {
        throw error;
      }

      throw new RedditAPIError(
        `Failed to fetch posts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Get rate limiting status
   * @returns Object with rate limit information
   */
  getRateLimitStatus() {
    return {
      canMakeRequest: this.rateLimiter.canMakeRequest(),
      timeUntilReset: this.rateLimiter.getTimeUntilReset(),
    };
  }
}

// Export singleton instance
export const redditClient = new RedditClientService();