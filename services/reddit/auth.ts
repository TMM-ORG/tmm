/**
 * Reddit OAuth2 Authentication Service
 * Implements app-only OAuth2 flow for server-side Reddit API access
 */

// Custom error for Reddit authentication failures
export class RedditAuthError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'RedditAuthError';
  }
}

// Interface for Reddit OAuth2 token response
interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// Interface for cached token with expiration
interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

class RedditAuthService {
  private baseUrl = 'https://www.reddit.com/api/v1';
  private cachedToken: CachedToken | null = null;
  private clientId: string;
  private clientSecret: string;
  private userAgent: string;

  constructor() {
    // Validate required environment variables
    this.clientId = process.env.REDDIT_CLIENT_ID!;
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET!;
    this.userAgent = process.env.REDDIT_USER_AGENT!;

    if (!this.clientId || !this.clientSecret || !this.userAgent) {
      throw new RedditAuthError(
        'Missing Reddit API credentials. Please check REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT environment variables.'
      );
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   * @returns Promise resolving to access token
   * @throws RedditAuthError when authentication fails
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5-minute buffer)
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 300000) {
      return this.cachedToken.accessToken;
    }

    // Request new token using app-only OAuth2 flow
    try {
      const response = await fetch(`${this.baseUrl}/access_token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent,
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        throw new RedditAuthError(
          `Authentication failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data: RedditTokenResponse = await response.json();

      // Cache the token with expiration time
      this.cachedToken = {
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
      };

      return data.access_token;
    } catch (error) {
      if (error instanceof RedditAuthError) {
        throw error;
      }

      throw new RedditAuthError(
        `Network error during authentication: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create authenticated headers for Reddit API requests
   * @returns Promise resolving to headers object
   */
  async getAuthenticatedHeaders(): Promise<Record<string, string>> {
    const accessToken = await this.getAccessToken();

    return {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': this.userAgent,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Clear cached token (useful for testing or forced refresh)
   */
  clearTokenCache(): void {
    this.cachedToken = null;
  }

  /**
   * Check if we have valid authentication credentials
   * @returns boolean indicating if credentials are available
   */
  hasValidCredentials(): boolean {
    return !!(this.clientId && this.clientSecret && this.userAgent);
  }
}

// Export singleton instance
export const redditAuth = new RedditAuthService();