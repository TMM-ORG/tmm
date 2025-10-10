/**
 * LLM-Based Text Cleaner for TTS
 * Uses Groq LLM to intelligently clean and format Reddit post text for natural speech
 */

import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { RedditPost } from '@/types/reddit';

export interface CleanedText {
  original: string;
  cleaned: string;
  wordCount: number;
  changes: string[];
}

class LLMTextCleanerService {
  private readonly model = groq('openai/gpt-oss-120b'); // Fast, free-tier friendly

  /**
   * Check if Groq API is configured
   */
  isConfigured(): boolean {
    return !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here';
  }

  /**
   * Clean Reddit post text using LLM for natural TTS narration
   * @param post - Reddit post to clean
   * @returns Cleaned text ready for TTS
   */
  async cleanForTTS(post: RedditPost): Promise<CleanedText> {
    if (!this.isConfigured()) {
      throw new Error('GROQ_API_KEY not configured. Please add your Groq API key to .env.local');
    }

    const originalText = `${post.title}. ${post.selftext || ''}`.trim();

    const prompt = `You are a text editor preparing Reddit posts for text-to-speech narration. Clean the text to remove formatting artifacts while preserving ALL original content, tone, and voice.

ORIGINAL POST:
Title: ${post.title}
Content: ${post.selftext || '(no body text)'}

CRITICAL RULES - Follow Exactly:

1. REMOVE PLATFORM-SPECIFIC FORMATTING:
   - Delete post flair tags (e.g., "S", "Serious", "NSFW" at the beginning)
   - Remove "TL;DR:" labels and redundant summaries
   - Remove "Edit:", "Update:", or similar labels (replace with natural language like "Edit:" → "Edit:")
   - Expand abbreviations that TTS might mispronounce (e.g., "TW:" → "Trigger warning:")

2. PRESERVE ALL ORIGINAL LANGUAGE:
   - Keep ALL slang, profanity, and colloquialisms exactly as written (e.g., "hella", "ass")
   - Maintain the author's voice and tone completely
   - Do not paraphrase, summarize, or reword anything
   - Keep grammatical errors and informal speech patterns

3. REMOVE MARKDOWN AND FORMATTING SYMBOLS:
   - Delete asterisks, underscores, and other markdown symbols used for bold/italic
   - Remove excessive punctuation used for emphasis (e.g., "!!!" can stay but reduce if excessive)
   - Keep natural punctuation for sentence flow

4. PRESERVE STRUCTURAL ELEMENTS:
   - Keep paragraph breaks for natural pauses
   - Maintain quotation marks for dialogue
   - Preserve ellipses (...) as they indicate natural speech pauses

5. HANDLE SECTION MARKERS:
   - Remove redundant section labels if the content flows naturally without them
   - Keep section markers if they provide necessary context (e.g., "Edit:")

6. HANDLE URLS:
   - Remove URLs completely

7. TEST FOR NATURAL READING:
   - Read the cleaned text aloud mentally
   - Ensure it sounds like natural speech
   - Verify no information or tone is lost

WHAT NOT TO CHANGE:
- Slang or informal language
- Profanity (unless specifically requested to remove)
- Grammatical quirks or run-on sentences
- The author's unique voice
- Any actual content or meaning

OUTPUT: Only the cleaned text, nothing else.

CLEANED TEXT:`;

    try {
      const { text: cleanedText } = await generateText({
        model: this.model,
        prompt,
        maxOutputTokens: 1000,
        temperature: 0.3, // Lower temperature for more consistent cleaning
      });

      const cleaned = cleanedText.trim();
      const wordCount = cleaned.split(/\s+/).length;

      // Identify changes made
      const changes: string[] = [];
      if (originalText.includes('http')) changes.push('Removed URLs');
      if (originalText.includes('*') || originalText.includes('**')) changes.push('Removed markdown');
      if (originalText !== cleaned) changes.push('Grammar/punctuation fixes');
      if (originalText.length > cleaned.length * 1.2) changes.push('Shortened content');

      return {
        original: originalText,
        cleaned,
        wordCount,
        changes
      };
    } catch (error) {
      throw new Error(
        `LLM text cleaning failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clean text with fallback to basic cleaning if LLM fails
   * @param post - Reddit post to clean
   * @param fallbackCleaner - Optional fallback cleaning function
   * @returns Cleaned text
   */
  async cleanWithFallback(
    post: RedditPost,
    fallbackCleaner?: (text: string) => string
  ): Promise<string> {
    try {
      const result = await this.cleanForTTS(post);
      return result.cleaned;
    } catch (error) {
      console.warn('LLM cleaning failed, using fallback:', error);

      if (fallbackCleaner) {
        const fullText = `${post.title}. ${post.selftext || ''}`.trim();
        return fallbackCleaner(fullText);
      }

      // Basic fallback if no cleaner provided
      return this.basicClean(post);
    }
  }

  /**
   * Basic text cleaning as fallback
   * @param post - Reddit post
   * @returns Basic cleaned text
   */
  private basicClean(post: RedditPost): string {
    let text = `${post.title}. ${post.selftext || ''}`.trim();

    // Remove URLs
    text = text.replace(/https?:\/\/\S+/g, '');

    // Remove markdown
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/~~([^~]+)~~/g, '$1');
    text = text.replace(/`([^`]+)`/g, '$1');

    // Clean up spacing
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Estimate token usage for a text
   * @param text - Text to estimate
   * @returns Estimated tokens (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

// Export singleton instance
export const llmTextCleaner = new LLMTextCleanerService();
