/**
 * Tests for Text Formatter Service
 */

import { textFormatter } from './formatter';
import { RedditPost } from '@/types/reddit';

describe('TextFormatterService', () => {
  const createMockPost = (overrides: Partial<RedditPost> = {}): RedditPost => ({
    id: 'test-id',
    title: 'Test Post Title',
    author: 'testuser',
    score: 100,
    num_comments: 50,
    created_utc: Date.now() / 1000,
    selftext: 'This is test content.',
    permalink: '/r/test/comments/test',
    subreddit: 'test',
    ...overrides
  });

  describe('formatForTTS', () => {
    it('should format basic post with title and body', () => {
      const post = createMockPost({
        title: 'Great Story',
        selftext: 'This is an amazing story about coding.'
      });

      const result = textFormatter.formatForTTS(post);

      expect(result.text).toContain('Great Story');
      expect(result.text).toContain('amazing story');
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.estimatedDuration).toBeGreaterThan(0);
    });

    it('should handle post with only title', () => {
      const post = createMockPost({
        title: 'Just a title here',
        selftext: ''
      });

      const result = textFormatter.formatForTTS(post);

      expect(result.text).toBe('Just a title here');
      expect(result.wordCount).toBe(4);
    });

    it('should remove markdown formatting', () => {
      const post = createMockPost({
        title: 'Normal Title',
        selftext: '**Bold text** and *italic text* and ~~strikethrough~~'
      });

      const result = textFormatter.formatForTTS(post);

      expect(result.text).not.toContain('**');
      expect(result.text).not.toContain('*');
      expect(result.text).not.toContain('~~');
      expect(result.text).toContain('Bold text');
      expect(result.text).toContain('italic text');
    });

    it('should clean URLs to domain only', () => {
      const post = createMockPost({
        title: 'Check this out',
        selftext: 'Visit https://www.example.com/very/long/path for more info'
      });

      const result = textFormatter.formatForTTS(post);

      expect(result.text).toContain('example.com');
      expect(result.text).not.toContain('/very/long/path');
    });

    it('should remove list markers', () => {
      const post = createMockPost({
        title: 'List Post',
        selftext: '- Item one\n- Item two\n* Item three\n1. Numbered item'
      });

      const result = textFormatter.formatForTTS(post);

      expect(result.text).not.toMatch(/^[\s]*[-*+]\s+/m);
      expect(result.text).not.toMatch(/^[\s]*\d+\.\s+/m);
      expect(result.text).toContain('Item one');
      expect(result.text).toContain('Numbered item');
    });

    it('should truncate long posts to fit max duration', () => {
      // Create a very long post (>90 seconds worth)
      const longText = 'Very long content. '.repeat(300); // ~600 words, >90 seconds

      const post = createMockPost({
        title: 'Long Post',
        selftext: longText
      });

      const result = textFormatter.formatForTTS(post);

      expect(result.estimatedDuration).toBeLessThanOrEqual(90);
      expect(result.wordCount).toBeLessThan(600);
    });

    it('should estimate duration correctly', () => {
      // ~150 words should be ~60 seconds at 150 WPM
      const text = 'Word '.repeat(150);

      const post = createMockPost({
        title: 'Duration Test',
        selftext: text
      });

      const result = textFormatter.formatForTTS(post);

      // Allow some margin for title words
      expect(result.estimatedDuration).toBeGreaterThan(50);
      expect(result.estimatedDuration).toBeLessThan(70);
    });

    it('should return correct word count', () => {
      const post = createMockPost({
        title: 'Five words in title',
        selftext: 'And ten more words in the body text here.'
      });

      const result = textFormatter.formatForTTS(post);

      // Title (4 words) + body (9 words) = 13 words
      expect(result.wordCount).toBe(13);
    });

    it('should handle empty selftext gracefully', () => {
      const post = createMockPost({
        title: 'Only title',
        selftext: ''
      });

      const result = textFormatter.formatForTTS(post);

      expect(result.text).toBe('Only title');
      expect(result.wordCount).toBe(2);
      expect(result.estimatedDuration).toBeGreaterThan(0);
    });

    it('should remove excessive whitespace', () => {
      const post = createMockPost({
        title: 'Title    with    spaces',
        selftext: 'Content   with   multiple   spaces'
      });

      const result = textFormatter.formatForTTS(post);

      expect(result.text).not.toContain('  '); // No double spaces
      expect(result.text).toContain('Title with spaces');
    });

    it('should handle special characters appropriately', () => {
      const post = createMockPost({
        title: 'Test | with # special',
        selftext: 'More ## content ### here'
      });

      const result = textFormatter.formatForTTS(post);

      expect(result.text).not.toContain('|');
      expect(result.text).not.toContain('#');
    });
  });
});
