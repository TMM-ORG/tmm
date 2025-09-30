# **Source Tree Structure**

## Project Root Structure

```
tmm/                                    # Project root
├── .next/                             # Next.js build output (auto-generated)
├── .ai/                               # AI debugging and logs
│   └── debug-log.md                   # Development debugging log
├── .bmad-core/                        # BMAD framework configuration
│   ├── core-config.yaml              # Project configuration
│   ├── checklists/                    # Validation checklists
│   ├── tasks/                         # Task workflows
│   └── templates/                     # Document templates
├── app/                               # Next.js App Router (main application code)
│   ├── api/                          # API routes
│   ├── globals.css                   # Global styles
│   ├── layout.tsx                    # Root layout component
│   ├── page.tsx                      # Home page component
│   └── test/                         # Optional: Simple test interface
├── docs/                             # Documentation
│   ├── architecture/                 # Architecture documentation (sharded)
│   ├── prd/                          # Product Requirements (sharded)
│   └── stories/                      # User stories for development
├── lib/                              # Shared utilities and configurations
├── services/                         # Business logic services
├── types/                            # TypeScript type definitions
├── tests/                            # Test files and utilities
├── public/                           # Static assets
├── .env.local                        # Local environment variables (gitignored)
├── .gitignore                        # Git ignore rules
├── package.json                      # Node.js dependencies and scripts
├── tsconfig.json                     # TypeScript configuration
├── next.config.ts                    # Next.js configuration
├── postcss.config.mjs               # PostCSS configuration
├── biome.json                        # Code formatter configuration
└── README.md                         # Project documentation
```

## App Directory Structure (Next.js App Router)

```
app/
├── api/                              # API routes
│   ├── generate/                     # Video generation endpoint
│   │   └── route.ts                  # POST /api/generate
│   ├── status/                       # Job status endpoints
│   │   └── [jobId]/
│   │       └── route.ts              # GET /api/status/[jobId]
│   ├── download/                     # Download endpoints
│   │   └── [jobId]/
│   │       └── route.ts              # GET /api/download/[jobId]
│   └── reddit/                       # Reddit API endpoints (testing)
│       └── posts/
│           └── route.ts              # GET /api/reddit/posts
├── test/                             # Optional: Simple web interface for testing
│   ├── page.tsx                      # Test interface component
│   └── layout.tsx                    # Test section layout
├── globals.css                       # Global CSS styles
├── layout.tsx                        # Root application layout
├── page.tsx                          # Home page
└── favicon.ico                       # Application favicon
```

## Services Directory Structure

```
services/
├── reddit/                           # Reddit API integration
│   ├── auth.ts                       # OAuth2 authentication
│   ├── client.ts                     # Reddit API client
│   ├── analyzer.ts                   # Post selection algorithm
│   └── types.ts                      # Reddit-specific types (if needed)
├── tts/                              # Text-to-Speech services
│   ├── elevenlabs.ts                 # ElevenLabs TTS integration
│   ├── inworld.ts                    # Inworld TTS integration
│   ├── formatter.ts                  # Text formatting for TTS
│   └── provider.ts                   # TTS provider interface/adapter
├── video/                            # Video processing services
│   ├── ffmpeg.ts                     # FFmpeg integration wrapper
│   ├── processor.ts                  # Video assembly logic
│   └── selector.ts                   # Background video selection
├── storage/                          # Data storage services
│   └── supabase.ts                   # Supabase operations
└── queue/                            # Job queue management
    └── jobs.ts                       # Job queue implementation
```

## Lib Directory Structure

```
lib/
├── supabase.ts                       # Supabase client initialization
├── utils.ts                          # General utility functions
├── constants.ts                      # Application constants
└── validations.ts                    # Input validation schemas
```

## Types Directory Structure

```
types/
├── reddit.ts                         # Reddit API response types
├── tts.ts                           # TTS service types
├── video.ts                         # Video processing types
├── database.ts                      # Supabase database types
└── api.ts                           # API request/response types
```

## Tests Directory Structure

```
tests/
├── fixtures/                        # Test data and mock objects
│   ├── reddit-posts.json           # Sample Reddit posts for testing
│   ├── audio-files/                # Sample audio files
│   └── video-files/                # Sample video files
├── integration/                     # Integration tests
│   ├── video-generation.test.ts    # End-to-end workflow tests
│   └── api-endpoints.test.ts       # API endpoint tests
├── unit/                           # Unit tests (organized by service)
│   ├── reddit/
│   │   ├── client.test.ts
│   │   └── analyzer.test.ts
│   ├── tts/
│   │   ├── elevenlabs.test.ts
│   │   └── formatter.test.ts
│   └── video/
│       ├── processor.test.ts
│       └── selector.test.ts
├── setup.ts                        # Test environment setup
└── utils.ts                        # Test utility functions
```

## Public Directory Structure

```
public/
├── background-videos/               # Background video library
│   ├── neutral/                    # Neutral/generic videos
│   ├── tech/                       # Technology-themed videos
│   ├── nature/                     # Nature-themed videos
│   └── abstract/                   # Abstract/artistic videos
├── favicon.ico                     # Application favicon
└── robots.txt                      # Search engine directives
```

## File Naming Conventions

### **TypeScript Files**
- **Services**: `kebab-case.ts` (e.g., `reddit-client.ts`, `video-processor.ts`)
- **Components**: `PascalCase.tsx` (e.g., `VideoPlayer.tsx`, `ProgressBar.tsx`)
- **Types**: `kebab-case.ts` (e.g., `reddit-types.ts`, `api-types.ts`)
- **Utilities**: `kebab-case.ts` (e.g., `date-utils.ts`, `string-helpers.ts`)

### **Test Files**
- **Unit tests**: `{filename}.test.ts` (e.g., `reddit-client.test.ts`)
- **Integration tests**: `{feature}.test.ts` (e.g., `video-generation.test.ts`)

### **API Routes**
- **Endpoints**: `route.ts` (Next.js App Router convention)
- **Directories**: `kebab-case` for multi-word endpoints

## Directory Creation Rules

### **When to Create New Directories**
1. **Services**: Create subdirectory when you have 3+ related files
2. **Components**: Group by feature when you have 5+ components
3. **Types**: Separate by domain (reddit, video, tts, etc.)
4. **Tests**: Mirror the source structure

### **Directory Depth Guidelines**
- **Maximum depth**: 4 levels from project root
- **Prefer flat structure**: Avoid unnecessary nesting
- **Group by feature**: Not by file type (except at top level)

## Import Path Conventions

### **Absolute Imports (Preferred)**
```typescript
// Use @ alias for app directory
import { VideoProcessor } from '@/services/video/processor';
import { RedditPost } from '@/types/reddit';

// Use @lib for lib directory
import { supabase } from '@lib/supabase';
```

### **Relative Imports (When Appropriate)**
```typescript
// Within same service directory
import { formatText } from './formatter';
import { TTSProvider } from './provider';

// For closely related files
import '../globals.css';
```

## Environment-Specific Files

### **Development**
```
.env.local                           # Local development environment variables
.env.example                        # Template for environment variables
```

### **Production**
- Environment variables set via Vercel dashboard
- No local .env files in production

## Generated/Build Files (Git Ignored)

```
.next/                               # Next.js build output
node_modules/                        # npm dependencies
.env.local                           # Environment variables
*.log                                # Log files
.vercel/                             # Vercel deployment cache
```

## File Organization Best Practices

### **Service Files**
- One main concern per file
- Export a single default service object or class
- Keep related utilities in same directory

### **Type Files**
- Group related types in single file
- Use clear, descriptive names
- Export individual types, not namespaces

### **Test Files**
- One test file per source file
- Group related tests in describe blocks
- Keep test data in fixtures directory

### **API Routes**
- One endpoint per route.ts file
- Use directory structure to represent URL structure
- Keep business logic in services, not in route handlers

---

**Critical Notes:**
- Follow this structure consistently across all development
- Create directories as needed following the naming conventions
- Keep imports clean using the established path conventions
- Mirror the source structure in tests for easy navigation