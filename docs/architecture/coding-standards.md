# **Coding Standards**

## TypeScript & Code Quality

### **Strict TypeScript Configuration**
- Use strict mode TypeScript (enabled by default in Next.js)
- No `any` types - use proper typing
- Enable all strict checks in `tsconfig.json`
- Use type assertions sparingly and with proper justification

### **Naming Conventions**
```typescript
// Files and directories: kebab-case
// Files: reddit-client.ts, post-analyzer.ts
// Directories: /services/reddit/, /components/video/

// Variables and functions: camelCase
const apiClient = createClient();
const fetchTopPosts = async () => {};

// Types and interfaces: PascalCase
interface RedditPost {
  id: string;
  title: string;
}

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_SUBREDDIT = 'popular';

// Components: PascalCase (React convention)
const VideoPlayer = () => {};
```

### **Function and Variable Standards**
- Use descriptive names: `fetchRedditPosts()` not `getData()`
- Async functions must be named with action verbs: `generateAudio()`, `processVideo()`
- Boolean variables: `isLoading`, `hasError`, `canRetry`
- Avoid abbreviations: `authentication` not `auth` (except widely accepted ones)

## File Organization

### **Import Order**
```typescript
// 1. External libraries
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// 2. Internal types
import { RedditPost, AudioFile } from '@/types/reddit';

// 3. Internal utilities and services
import { redditClient } from '@/services/reddit/client';
import { ttsService } from '@/services/tts/elevenlabs';

// 4. Relative imports
import './styles.css';
```

### **Export Standards**
```typescript
// Prefer named exports for utilities and services
export const redditService = {
  fetchPosts: () => {},
  authenticateApp: () => {}
};

// Default exports only for React components and main modules
export default function VideoGenerator() {}

// Use explicit return types for functions
export const processVideo = async (audioUrl: string): Promise<VideoResult> => {
  // implementation
};
```

## Error Handling

### **Error Patterns**
```typescript
// Use custom error classes
class RedditAPIError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'RedditAPIError';
  }
}

// Async/await with proper error handling
try {
  const posts = await redditClient.fetchTopPosts(subreddit);
  return posts;
} catch (error) {
  if (error instanceof RedditAPIError) {
    // Handle specific API errors
    throw new Error(`Reddit API failed: ${error.message}`);
  }
  // Re-throw unexpected errors
  throw error;
}

// API route error responses
return NextResponse.json(
  { error: 'Invalid subreddit name', code: 'INVALID_SUBREDDIT' },
  { status: 400 }
);
```

### **Logging Standards**
```typescript
// Use console methods appropriately
console.log('Info: Processing started'); // Development only
console.warn('Warning: Rate limit approaching');
console.error('Error: Reddit API failed', error);

// Structured logging for production
const logError = (context: string, error: Error, metadata?: object) => {
  console.error({
    context,
    message: error.message,
    stack: error.stack,
    ...metadata
  });
};
```

## Testing Standards

### **Test File Naming**
```
src/services/reddit/client.ts
src/services/reddit/client.test.ts

src/components/VideoPlayer.tsx
src/components/VideoPlayer.test.tsx
```

### **Test Structure**
```typescript
describe('RedditClient', () => {
  describe('fetchTopPosts', () => {
    it('should return top 10 posts for valid subreddit', async () => {
      // Arrange
      const subreddit = 'technology';
      const mockPosts = createMockPosts(10);

      // Act
      const result = await redditClient.fetchTopPosts(subreddit);

      // Assert
      expect(result).toHaveLength(10);
      expect(result[0]).toMatchObject({
        title: expect.any(String),
        score: expect.any(Number)
      });
    });
  });
});
```

### **Mock Standards**
```typescript
// Mock external dependencies consistently
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(),
    storage: {
      from: jest.fn()
    }
  }))
}));

// Use factories for test data
const createMockRedditPost = (overrides = {}): RedditPost => ({
  id: 'test-id',
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
```

## API Development

### **API Route Standards**
```typescript
// app/api/generate/route.ts
export async function POST(request: NextRequest) {
  try {
    // 1. Validate input
    const body = await request.json();
    const { subreddit } = body;

    if (!subreddit || typeof subreddit !== 'string') {
      return NextResponse.json(
        { error: 'Subreddit is required', code: 'MISSING_SUBREDDIT' },
        { status: 400 }
      );
    }

    // 2. Process request
    const jobId = await videoService.startGeneration(subreddit);

    // 3. Return success response
    return NextResponse.json({
      jobId,
      status: 'pending',
      message: 'Video generation started'
    });
  } catch (error) {
    console.error('Video generation failed:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

### **Type Safety for APIs**
```typescript
// Define request/response types
interface GenerateVideoRequest {
  subreddit: string;
}

interface GenerateVideoResponse {
  jobId: string;
  status: 'pending';
  message: string;
}

interface ErrorResponse {
  error: string;
  code: string;
}
```

## Environment and Configuration

### **Environment Variables**
```typescript
// Use validation for environment variables
const requiredEnvVars = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET
} as const;

// Validate at startup
Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});
```

### **Configuration Management**
```typescript
// Use typed configuration objects
export const config = {
  reddit: {
    userAgent: process.env.REDDIT_USER_AGENT!,
    rateLimit: 60, // requests per minute
    timeout: 10000 // 10 seconds
  },
  tts: {
    provider: 'elevenlabs' as const,
    voice: 'rachel',
    format: 'mp3_44100_128'
  },
  video: {
    outputFormat: 'mp4',
    resolution: '1920x1080',
    fps: 30
  }
} as const;
```

## Performance and Best Practices

### **Async/Await Best Practices**
```typescript
// Don't await in loops - use Promise.all for parallel operations
const results = await Promise.all(
  urls.map(url => fetchData(url))
);

// Use proper error handling with Promise.allSettled for non-critical operations
const results = await Promise.allSettled(
  posts.map(post => processPost(post))
);
```

### **Resource Management**
```typescript
// Clean up resources properly
const cleanup = () => {
  ffmpegProcess?.kill();
  tempFiles.forEach(file => fs.unlinkSync(file));
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
```

## Documentation Standards

### **Function Documentation**
```typescript
/**
 * Fetches top posts from a Reddit subreddit
 * @param subreddit - The subreddit name (without /r/ prefix)
 * @param limit - Number of posts to fetch (default: 10, max: 25)
 * @returns Promise resolving to array of Reddit posts
 * @throws RedditAPIError when API request fails
 * @throws ValidationError when subreddit name is invalid
 */
export const fetchTopPosts = async (
  subreddit: string,
  limit: number = 10
): Promise<RedditPost[]> => {
  // implementation
};
```

### **README Requirements**
Each service/module should include:
- Purpose and functionality
- Installation/setup instructions
- Usage examples
- Environment variables needed
- Testing instructions

## Security Standards

### **Data Sanitization**
```typescript
// Sanitize user inputs
const sanitizeSubreddit = (input: string): string => {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 50); // Limit length
};
```

### **Secrets Management**
- Never commit secrets to version control
- Use environment variables for all credentials
- Validate environment variables at startup
- Use different secrets for development/production

### **API Security**
- Implement rate limiting on all public endpoints
- Validate all inputs thoroughly
- Use HTTPS in production
- Implement proper CORS policies

---

**Critical**: All code must pass TypeScript strict checks and have accompanying tests before merging.