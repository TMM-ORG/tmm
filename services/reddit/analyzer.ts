/**
 * Reddit Post Analyzer Service
 * Selects the best post from a list based on engagement, content quality, and text length
 */

import { RedditPost } from '@/types/reddit';

// Post scoring interface
export interface PostScore {
  post: RedditPost;
  engagementScore: number;  // (score + comments * 0.3) / age_hours
  textLength: number;        // word count
  contentQuality: number;    // based on text structure, paragraphs
  totalScore: number;        // weighted combination
}

// Configuration for post selection algorithm
export const POST_SELECTION_CONFIG = {
  // Scoring weights
  weights: {
    engagement: 0.4,
    textLength: 0.3,
    quality: 0.3
  },

  // Text length preferences (in words)
  textLength: {
    min: 50,           // Posts with < 50 words heavily penalized
    ideal_min: 100,    // Ideal range start
    ideal_max: 500,    // Ideal range end
    max: 800           // Posts with > 800 words penalized
  },

  // Audio duration estimates
  audio: {
    wordsPerMinute: 150,  // Average speaking rate
    maxDurationSeconds: 90 // Maximum video length
  }
} as const;

class PostAnalyzerService {
  /**
   * Count words in text
   * @param text - The text to count words in
   * @returns Number of words
   */
  private countWords(text: string): number {
    if (!text || text.trim().length === 0) return 0;

    // Remove extra whitespace and split on word boundaries
    return text.trim().split(/\s+/).length;
  }

  /**
   * Calculate age of post in hours
   * @param created_utc - Unix timestamp of post creation
   * @returns Age in hours
   */
  private getPostAgeHours(created_utc: number): number {
    const now = Date.now() / 1000; // Convert to Unix timestamp
    const ageSeconds = now - created_utc;
    return Math.max(ageSeconds / 3600, 0.1); // Minimum 0.1 hours to avoid division by zero
  }

  /**
   * Calculate engagement score
   * Engagement = (score + comments * 0.3) / age_hours
   * @param post - Reddit post to score
   * @returns Engagement score (normalized 0-1)
   */
  private calculateEngagementScore(post: RedditPost): number {
    const ageHours = this.getPostAgeHours(post.created_utc);
    const rawEngagement = (post.score + post.num_comments * 0.3) / ageHours;

    // Normalize to 0-1 range (log scale for better distribution)
    // Typical engagement ranges from 1-1000, so log10 gives us ~0-3 range
    const normalized = Math.min(Math.log10(rawEngagement + 1) / 3, 1);

    return normalized;
  }

  /**
   * Calculate text length score
   * Prioritizes 100-500 words, penalizes too short (<50) or too long (>800)
   * @param wordCount - Number of words in post
   * @returns Text length score (0-1)
   */
  private calculateTextLengthScore(wordCount: number): number {
    const { min, ideal_min, ideal_max, max } = POST_SELECTION_CONFIG.textLength;

    // No text content
    if (wordCount === 0) return 0;

    // Too short
    if (wordCount < min) {
      return wordCount / min * 0.3; // Max 0.3 score for very short posts
    }

    // Ideal range
    if (wordCount >= ideal_min && wordCount <= ideal_max) {
      return 1.0;
    }

    // Between min and ideal_min
    if (wordCount < ideal_min) {
      const range = ideal_min - min;
      const position = wordCount - min;
      return 0.3 + (position / range) * 0.7; // Scale from 0.3 to 1.0
    }

    // Between ideal_max and max
    if (wordCount <= max) {
      const range = max - ideal_max;
      const position = wordCount - ideal_max;
      return 1.0 - (position / range) * 0.5; // Scale from 1.0 to 0.5
    }

    // Too long
    return 0.3;
  }

  /**
   * Calculate content quality score
   * Based on text structure, paragraphs, sentence variety
   * @param text - Post text content
   * @returns Quality score (0-1)
   */
  private calculateContentQuality(text: string): number {
    if (!text || text.trim().length === 0) return 0;

    let score = 0.5; // Base score

    // Check for paragraphs (multiple line breaks indicate structure)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) {
      score += 0.2; // Bonus for structured content
    }

    // Check for sentences (periods, question marks, exclamation marks)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 2) {
      score += 0.15; // Bonus for multiple sentences
    }

    // Penalize excessive caps (likely spam or low quality)
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.3) {
      score -= 0.2;
    }

    // Penalize URLs in selftext (indicates link post with minimal text)
    const urlCount = (text.match(/https?:\/\/\S+/g) || []).length;
    if (urlCount > 2) {
      score -= 0.15;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check if post has usable text content
   * Filters out posts with only links/images
   * @param post - Reddit post to check
   * @returns True if post has usable text content
   */
  private hasUsableTextContent(post: RedditPost): boolean {
    const text = (post.title + ' ' + post.selftext).trim();
    const wordCount = this.countWords(text);

    // Must have at least some text
    if (wordCount < 10) return false;

    // Check if selftext is mostly just a URL
    if (post.selftext && post.selftext.trim().startsWith('http')) {
      const urlLength = (post.selftext.match(/https?:\/\/\S+/g) || []).join('').length;
      if (urlLength / post.selftext.length > 0.8) return false;
    }

    return true;
  }

  /**
   * Score a single post
   * @param post - Reddit post to score
   * @returns Post score object
   */
  private scorePost(post: RedditPost): PostScore {
    const fullText = post.title + ' ' + post.selftext;
    const wordCount = this.countWords(fullText);

    const engagementScore = this.calculateEngagementScore(post);
    const textLengthScore = this.calculateTextLengthScore(wordCount);
    const contentQualityScore = this.calculateContentQuality(fullText);

    const { weights } = POST_SELECTION_CONFIG;
    const totalScore =
      engagementScore * weights.engagement +
      textLengthScore * weights.textLength +
      contentQualityScore * weights.quality;

    return {
      post,
      engagementScore,
      textLength: wordCount,
      contentQuality: contentQualityScore,
      totalScore
    };
  }

  /**
   * Select the best post from a list of posts
   * @param posts - Array of Reddit posts to analyze
   * @returns The selected post with its score, or null if no suitable post found
   */
  selectBestPost(posts: RedditPost[]): PostScore | null {
    if (!posts || posts.length === 0) {
      return null;
    }

    // Filter posts with usable text content
    const usablePosts = posts.filter(post => this.hasUsableTextContent(post));

    if (usablePosts.length === 0) {
      return null;
    }

    // Score all usable posts
    const scoredPosts = usablePosts.map(post => this.scorePost(post));

    // Sort by total score descending
    scoredPosts.sort((a, b) => b.totalScore - a.totalScore);

    // Return the highest scoring post
    return scoredPosts[0];
  }

  /**
   * Estimate audio duration for a post
   * @param post - Reddit post
   * @returns Estimated duration in seconds
   */
  estimateAudioDuration(post: RedditPost): number {
    const fullText = post.title + ' ' + post.selftext;
    const wordCount = this.countWords(fullText);
    const { wordsPerMinute } = POST_SELECTION_CONFIG.audio;

    return Math.ceil((wordCount / wordsPerMinute) * 60);
  }

  /**
   * Check if post would exceed maximum duration
   * @param post - Reddit post
   * @returns True if duration is within limits
   */
  isWithinDurationLimit(post: RedditPost): boolean {
    const duration = this.estimateAudioDuration(post);
    return duration <= POST_SELECTION_CONFIG.audio.maxDurationSeconds;
  }
}

// Export singleton instance
export const postAnalyzer = new PostAnalyzerService();
