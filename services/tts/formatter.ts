/**
 * Text Formatting Service for TTS
 * Prepares Reddit post text for natural speech synthesis
 */

import { RedditPost } from '@/types/reddit';

export interface FormattedText {
  text: string;
  wordCount: number;
  estimatedDuration: number; // in seconds
}

class TextFormatterService {
  private readonly MAX_DURATION_SECONDS = 90;
  private readonly WORDS_PER_MINUTE = 150;

  /**
   * Remove Reddit markdown and special formatting
   * @param text - Raw text to clean
   * @returns Cleaned text
   */
  private cleanMarkdown(text: string): string {
    let cleaned = text;

    // Remove URLs but keep the domain for context
    cleaned = cleaned.replace(/https?:\/\/(www\.)?([^\s]+\.[^\s]+)/g, (match, www, domain) => {
      const cleanDomain = domain.split('/')[0];
      return cleanDomain;
    });

    // Remove Reddit markdown formatting
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1'); // Italic
    cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1'); // Strikethrough
    cleaned = cleaned.replace(/\^([^\s]+)/g, '$1'); // Superscript
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1'); // Code

    // Remove list markers but keep the text
    cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, ''); // Unordered lists
    cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, ''); // Ordered lists

    // Remove blockquote markers
    cleaned = cleaned.replace(/^>\s+/gm, '');

    // Remove multiple consecutive spaces
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Remove special characters that don't read well
    cleaned = cleaned.replace(/[#|]/g, '');

    return cleaned.trim();
  }

  /**
   * Add natural pauses between sections
   * @param text - Text to add pauses to
   * @returns Text with pause markers
   */
  private addPauses(text: string): string {
    // Add longer pause after title (represented by double newline)
    let formatted = text;

    // Ensure paragraphs have proper pauses
    formatted = formatted.replace(/\n\n+/g, '.\n\n'); // Add period before paragraph breaks

    // Add brief pause after sentences
    formatted = formatted.replace(/([.!?])\s+/g, '$1 ');

    return formatted;
  }

  /**
   * Estimate speaking duration
   * @param wordCount - Number of words
   * @returns Duration in seconds
   */
  private estimateDuration(wordCount: number): number {
    return Math.ceil((wordCount / this.WORDS_PER_MINUTE) * 60);
  }

  /**
   * Count words in text
   * @param text - Text to count
   * @returns Word count
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Truncate text to fit within max duration
   * @param text - Text to truncate
   * @param maxWords - Maximum word count
   * @returns Truncated text
   */
  private truncateToMaxDuration(text: string, maxWords: number): string {
    const words = text.split(/\s+/);

    if (words.length <= maxWords) {
      return text;
    }

    // Truncate and add ellipsis at sentence boundary if possible
    const truncated = words.slice(0, maxWords).join(' ');
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );

    if (lastSentenceEnd > truncated.length * 0.7) {
      // If we can end at a sentence boundary near the end, do so
      return truncated.substring(0, lastSentenceEnd + 1);
    }

    // Otherwise, truncate at word boundary with ellipsis
    return truncated + '...';
  }

  /**
   * Format Reddit post for TTS
   * @param post - Reddit post to format
   * @returns Formatted text ready for TTS
   */
  formatForTTS(post: RedditPost): FormattedText {
    // Combine title and body
    const title = this.cleanMarkdown(post.title);
    const body = post.selftext ? this.cleanMarkdown(post.selftext) : '';

    // Create combined text with pause between title and body
    let combinedText = title;
    if (body) {
      combinedText += '. ' + body;
    }

    // Count words and check duration
    let wordCount = this.countWords(combinedText);
    let estimatedDuration = this.estimateDuration(wordCount);

    // Truncate if exceeds max duration
    if (estimatedDuration > this.MAX_DURATION_SECONDS) {
      const maxWords = Math.floor((this.MAX_DURATION_SECONDS / 60) * this.WORDS_PER_MINUTE);
      combinedText = this.truncateToMaxDuration(combinedText, maxWords);
      wordCount = this.countWords(combinedText);
      estimatedDuration = this.estimateDuration(wordCount);
    }

    // Add natural pauses
    const formattedText = this.addPauses(combinedText);

    return {
      text: formattedText,
      wordCount,
      estimatedDuration
    };
  }

  /**
   * Add emphasis markers for important phrases (optional enhancement)
   * @param text - Text to enhance
   * @returns Text with emphasis markers
   */
  addEmphasis(text: string): string {
    // This could be enhanced to detect important phrases
    // For now, we'll keep it simple
    return text;
  }
}

// Export singleton instance
export const textFormatter = new TextFormatterService();
