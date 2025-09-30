/**
 * TypeScript interfaces for Reddit API responses
 * Based on Reddit's JSON API structure
 */

// Main Reddit post interface as specified in the story requirements
export interface RedditPost {
  id: string;
  title: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  selftext: string;
  permalink: string;
  subreddit: string;
}

// Extended Reddit post interface with additional fields from API
export interface RedditPostFull extends RedditPost {
  name: string; // Full name with prefix (e.g., "t3_abc123")
  url: string;
  domain: string;
  is_self: boolean;
  link_flair_text: string | null;
  author_flair_text: string | null;
  thumbnail: string;
  preview?: {
    images: Array<{
      source: {
        url: string;
        width: number;
        height: number;
      };
    }>;
  };
  upvote_ratio: number;
  gilded: number;
  archived: boolean;
  locked: boolean;
  over_18: boolean;
  spoiler: boolean;
  stickied: boolean;
}

// Reddit API response structure for listing endpoints
export interface RedditApiResponse {
  kind: string; // Should be "Listing"
  data: {
    after: string | null;
    before: string | null;
    dist: number | null;
    modhash: string;
    geo_filter: string;
    children: Array<{
      kind: string; // Should be "t3" for posts
      data: RedditPostFull;
    }>;
  };
}

// Request parameters for fetching posts
export interface FetchPostsParams {
  subreddit: string;
  limit?: number; // Default 10, max 100
  sort?: 'hot' | 'new' | 'rising' | 'top';
  time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  after?: string; // For pagination
  before?: string; // For pagination
}

// Response from our Reddit service (simplified)
export interface RedditServiceResponse {
  posts: RedditPost[];
  after: string | null; // For pagination
  before: string | null; // For pagination
}

// Error response from Reddit API
export interface RedditErrorResponse {
  message: string;
  error: number;
}

// Subreddit validation result
export interface SubredditValidation {
  isValid: boolean;
  exists: boolean;
  isPublic: boolean;
  reason?: string;
}