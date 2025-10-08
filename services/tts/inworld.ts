/**
 * Inworld TTS Service (Fallback Provider)
 * Integrates with Inworld AI Text-to-Speech API
 */

import { TTSProvider } from './provider';

// Inworld API error
export class InworldError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'InworldError';
  }
}

// Inworld configuration
export const INWORLD_CONFIG = {
  character: process.env.INWORLD_CHARACTER_ID || 'narrator_01',
  emotions: {
    neutral: 0.7,
    interested: 0.3
  },
  outputFormat: 'mp3'
} as const;

class InworldService implements TTSProvider {
  public readonly name = 'inworld';
  private readonly apiKey: string;
  private readonly workspaceId: string;
  private readonly baseUrl = 'https://api.inworld.ai/v1';

  constructor() {
    const apiKey = process.env.INWORLD_API_KEY;
    const workspaceId = process.env.INWORLD_WORKSPACE_ID;

    if (!apiKey) {
      throw new Error('INWORLD_API_KEY environment variable is required');
    }

    if (!workspaceId) {
      throw new Error('INWORLD_WORKSPACE_ID environment variable is required');
    }

    this.apiKey = apiKey;
    this.workspaceId = workspaceId;
  }

  /**
   * Generate speech from text using Inworld
   * @param text - Text to convert to speech
   * @param options - Optional character and emotion overrides
   * @returns Audio buffer (MP3 format)
   */
  async generateSpeech(
    text: string,
    options?: {
      character?: string;
      emotions?: typeof INWORLD_CONFIG.emotions;
    }
  ): Promise<Buffer> {
    const character = options?.character || INWORLD_CONFIG.character;
    const emotions = options?.emotions || INWORLD_CONFIG.emotions;

    try {
      const response = await fetch(
        `${this.baseUrl}/workspaces/${this.workspaceId}/characters/${character}/tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            text,
            emotions,
            output_format: INWORLD_CONFIG.outputFormat
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Inworld API error: ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || response.statusText;
        }

        throw new InworldError(errorMessage, response.status);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof InworldError) {
        throw error;
      }

      throw new InworldError(
        `Failed to generate speech: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Check if Inworld API is available
   * @returns True if API credentials are valid and service is accessible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/workspaces/${this.workspaceId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get remaining quota
   * Note: Inworld quota checking may vary based on plan
   * @returns -1 for unlimited or unknown
   */
  async getQuotaRemaining(): Promise<number> {
    // Inworld quota depends on plan and may not have a direct API endpoint
    // Return -1 to indicate unknown/unlimited
    return -1;
  }
}

// Export singleton instance (created lazily to avoid errors when env vars missing)
let inworldInstance: InworldService | null = null;

export const getInworld = (): InworldService => {
  if (!inworldInstance) {
    inworldInstance = new InworldService();
  }
  return inworldInstance;
};

// Export class for testing
export { InworldService };
