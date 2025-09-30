# TikTok-Style Video Generator from Reddit Posts

A Next.js application that automatically generates TikTok-style videos from Reddit posts. The application fetches popular posts from any subreddit, converts them to speech using text-to-speech technology, and assembles them into engaging short-form videos.

## Features

- **Reddit Integration**: Fetch top posts from any subreddit with robust error handling
- **OAuth2 Authentication**: Secure Reddit API access using app-only OAuth2 flow
- **Rate Limiting**: Built-in rate limiting to respect Reddit's API limits (60 requests/minute)
- **Subreddit Validation**: Automatic validation of subreddit names and accessibility
- **Comprehensive Testing**: Full test coverage with Jest and comprehensive error handling
- **TypeScript**: Fully typed codebase for better development experience

## Tech Stack

- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript 5.8+
- **Database**: Supabase (PostgreSQL)
- **Testing**: Jest with comprehensive mocking
- **Deployment**: Vercel-ready configuration
- **APIs**: Reddit API integration

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun
- Reddit API credentials
- Supabase account

### Environment Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Create a `.env.local` file with the following variables:

```env
# Reddit API Configuration
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=your_app_name:1.0.0 (by /u/your_username)

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Reddit API Setup

1. Go to [Reddit App Preferences](https://www.reddit.com/prefs/apps)
2. Click "Create App" or "Create Another App"
3. Choose "script" as the app type
4. Use the Client ID and Secret in your environment variables

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Testing

Run the test suite:

```bash
npm test
# or
yarn test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## API Endpoints

### Reddit Posts API

Fetch posts from a subreddit:

```
GET /api/reddit/posts?subreddit=technology&limit=10
```

**Parameters:**
- `subreddit` (required): Name of the subreddit (without /r/ prefix)
- `limit` (optional): Number of posts to fetch (1-25, default: 10)

**Response:**
```json
{
  "posts": [
    {
      "id": "abc123",
      "title": "Amazing Technology Discovery",
      "author": "username",
      "score": 1500,
      "num_comments": 250,
      "created_utc": 1700000000,
      "selftext": "Post content...",
      "permalink": "/r/technology/comments/abc123/...",
      "subreddit": "technology"
    }
  ],
  "subreddit": "technology",
  "count": 10
}
```

## Project Structure

```
├── app/                    # Next.js App Router pages and layouts
│   ├── api/               # API routes
│   │   └── reddit/        # Reddit API endpoints
│   └── page.tsx           # Main application page
├── services/              # Business logic and external API integrations
│   └── reddit/           # Reddit API service layer
│       ├── auth.ts       # OAuth2 authentication
│       ├── client.ts     # API client with rate limiting
│       └── *.test.ts     # Comprehensive test suite
├── lib/                  # Utility functions and configurations
│   └── supabase.ts       # Supabase client configuration
├── types/                # TypeScript type definitions
└── tests/                # Test fixtures and utilities
    └── fixtures/         # Mock data for testing
```

## Development Guidelines

- Follow the established coding standards in `docs/architecture/coding-standards.md`
- All new features require comprehensive tests
- Use TypeScript for type safety
- Follow the established error handling patterns
- Respect Reddit's API rate limits and terms of service

## Deployment

The application is configured for deployment on Vercel:

```bash
npm run build
```

For Vercel deployment, ensure all environment variables are configured in your Vercel project settings.

## Contributing

1. Follow the established coding standards
2. Write comprehensive tests for new features
3. Ensure all tests pass before submitting changes
4. Update documentation as needed

## License

This project is for educational and personal use. Please respect Reddit's API terms of service and rate limits.
