/**
 * Reddit Posts API Endpoint
 * GET /api/reddit/posts?subreddit={name}&limit={number}
 * Fetches top posts from a specified subreddit for testing purposes
 */

import { NextRequest, NextResponse } from 'next/server';
import { redditClient, RedditAPIError } from '@/services/reddit/client';
import { RedditAuthError } from '@/services/reddit/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subreddit = searchParams.get('subreddit');
    const limitParam = searchParams.get('limit');

    // Validate required parameters
    if (!subreddit) {
      return NextResponse.json(
        {
          error: 'Subreddit parameter is required',
          code: 'MISSING_SUBREDDIT',
          usage: '/api/reddit/posts?subreddit={name}&limit={number}'
        },
        { status: 400 }
      );
    }

    // Validate and parse limit parameter
    let limit = 10; // Default
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 25) {
        return NextResponse.json(
          {
            error: 'Limit must be a number between 1 and 25',
            code: 'INVALID_LIMIT'
          },
          { status: 400 }
        );
      }
      limit = parsedLimit;
    }

    // Validate subreddit format
    if (typeof subreddit !== 'string' || subreddit.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Subreddit must be a non-empty string',
          code: 'INVALID_SUBREDDIT'
        },
        { status: 400 }
      );
    }

    // Fetch posts from Reddit
    const posts = await redditClient.fetchTopPosts(subreddit.trim(), limit);

    // Get rate limit status for debugging
    const rateLimitStatus = redditClient.getRateLimitStatus();

    // Return successful response
    return NextResponse.json({
      success: true,
      data: {
        subreddit: subreddit.trim(),
        posts,
        count: posts.length,
        requestedLimit: limit
      },
      meta: {
        timestamp: new Date().toISOString(),
        rateLimit: rateLimitStatus
      }
    });

  } catch (error) {
    console.error('Reddit API endpoint error:', error);

    // Handle specific Reddit API errors
    if (error instanceof RedditAPIError) {
      const statusCode = error.statusCode;

      // Map Reddit errors to appropriate HTTP status codes
      if (statusCode === 404) {
        return NextResponse.json(
          {
            error: 'Subreddit not found or is private',
            code: 'SUBREDDIT_NOT_FOUND'
          },
          { status: 404 }
        );
      }

      if (statusCode === 403) {
        return NextResponse.json(
          {
            error: 'Access forbidden - subreddit may be private or banned',
            code: 'ACCESS_FORBIDDEN'
          },
          { status: 403 }
        );
      }

      if (statusCode === 429) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED'
          },
          { status: 429 }
        );
      }

      if (statusCode === 400) {
        return NextResponse.json(
          {
            error: error.message,
            code: 'INVALID_REQUEST'
          },
          { status: 400 }
        );
      }

      // Other Reddit API errors
      return NextResponse.json(
        {
          error: `Reddit API error: ${error.message}`,
          code: 'REDDIT_API_ERROR'
        },
        { status: statusCode || 500 }
      );
    }

    // Handle Reddit authentication errors
    if (error instanceof RedditAuthError) {
      return NextResponse.json(
        {
          error: 'Reddit authentication failed. Please check API credentials.',
          code: 'AUTH_ERROR'
        },
        { status: 401 }
      );
    }

    // Handle unexpected errors
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    {
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      allowedMethods: ['GET']
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      allowedMethods: ['GET']
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      allowedMethods: ['GET']
    },
    { status: 405 }
  );
}