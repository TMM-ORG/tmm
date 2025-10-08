/**
 * TTS Service with Provider Failover
 * Manages multiple TTS providers with automatic fallback
 */

import { TTSProvider, AudioGenerationResult } from './provider';
import { getElevenLabs, ElevenLabsError, ELEVENLABS_CONFIG } from './elevenlabs';
import { getInworld, InworldError, INWORLD_CONFIG } from './inworld';
import { textFormatter } from './formatter';
import { RedditPost } from '@/types/reddit';

// TTS service error
export class TTSServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TTSServiceError';
  }
}

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 2
} as const;

class TTSService {
  private providers: TTSProvider[] = [];
  private currentProviderIndex = 0;

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize available TTS providers in priority order
   */
  private initializeProviders() {
    try {
      // Primary: ElevenLabs
      const elevenLabs = getElevenLabs();
      this.providers.push(elevenLabs);
    } catch (error) {
      console.warn('ElevenLabs not available:', error instanceof Error ? error.message : 'Unknown error');
    }

    try {
      // Fallback: Inworld
      const inworld = getInworld();
      this.providers.push(inworld);
    } catch (error) {
      console.warn('Inworld not available:', error instanceof Error ? error.message : 'Unknown error');
    }

    if (this.providers.length === 0) {
      throw new TTSServiceError(
        'No TTS providers configured. Please set ELEVENLABS_API_KEY or INWORLD_API_KEY.',
        'NO_PROVIDERS'
      );
    }
  }

  /**
   * Wait with exponential backoff
   * @param attempt - Current attempt number
   */
  private async waitWithBackoff(attempt: number): Promise<void> {
    const delay = Math.min(
      RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
      RETRY_CONFIG.maxDelayMs
    );

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Get estimated audio duration from text
   * @param text - Text to estimate
   * @returns Duration in seconds
   */
  private estimateDuration(text: string): number {
    const formatted = textFormatter.formatForTTS({
      id: '',
      title: text,
      selftext: '',
      author: '',
      score: 0,
      num_comments: 0,
      created_utc: 0,
      permalink: '',
      subreddit: ''
    });
    return formatted.estimatedDuration;
  }

  /**
   * Generate audio using a specific provider with retry logic
   * @param provider - TTS provider to use
   * @param text - Text to convert
   * @returns Audio buffer
   */
  private async generateWithRetry(
    provider: TTSProvider,
    text: string
  ): Promise<Buffer> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        // Check if provider is available before attempting
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
          throw new Error(`Provider ${provider.name} is not available`);
        }

        // Generate speech
        const audioBuffer = await provider.generateSpeech(text);
        return audioBuffer;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on quota/auth errors
        if (error instanceof ElevenLabsError || error instanceof InworldError) {
          if (error.statusCode === 401 || error.statusCode === 403) {
            throw error; // Authentication errors shouldn't be retried
          }
          if (error.statusCode === 429) {
            // Rate limit - wait longer
            if (attempt < RETRY_CONFIG.maxAttempts) {
              await this.waitWithBackoff(attempt + 1);
              continue;
            }
          }
        }

        // Wait before retry
        if (attempt < RETRY_CONFIG.maxAttempts) {
          console.warn(`Attempt ${attempt} failed for ${provider.name}, retrying...`);
          await this.waitWithBackoff(attempt);
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Generate audio with automatic provider failover
   * @param post - Reddit post to convert to speech
   * @returns Audio generation result
   */
  async generateAudio(post: RedditPost): Promise<AudioGenerationResult> {
    // Format text for TTS
    const formatted = textFormatter.formatForTTS(post);
    const text = formatted.text;

    let lastError: Error | null = null;

    // Try each provider in order
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];

      try {
        console.log(`Attempting to generate audio with ${provider.name}...`);

        const audioBuffer = await this.generateWithRetry(provider, text);

        // Determine voice used based on provider
        let voiceUsed = 'unknown';
        if (provider.name === 'elevenlabs') {
          voiceUsed = ELEVENLABS_CONFIG.voiceId;
        } else if (provider.name === 'inworld') {
          voiceUsed = INWORLD_CONFIG.character;
        }

        return {
          audioBuffer,
          provider: provider.name,
          voice: voiceUsed,
          duration: formatted.estimatedDuration,
          sizeBytes: audioBuffer.length
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Provider ${provider.name} failed:`, lastError.message);

        // Continue to next provider
        if (i < this.providers.length - 1) {
          console.log(`Failing over to next provider...`);
        }
      }
    }

    // All providers failed
    throw new TTSServiceError(
      `All TTS providers failed. Last error: ${lastError?.message || 'Unknown error'}`,
      'ALL_PROVIDERS_FAILED'
    );
  }

  /**
   * Get status of all providers
   * @returns Provider availability status
   */
  async getProvidersStatus(): Promise<Array<{ name: string; available: boolean; quota: number }>> {
    const status = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          const available = await provider.isAvailable();
          const quota = await provider.getQuotaRemaining();
          return { name: provider.name, available, quota };
        } catch {
          return { name: provider.name, available: false, quota: -1 };
        }
      })
    );

    return status;
  }
}

// Export singleton instance
export const ttsService = new TTSService();

// Export errors and types
export { TTSServiceError, AudioGenerationResult };
export type { TTSProvider };
