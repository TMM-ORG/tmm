/**
 * ElevenLabs TTS Service
 * Integrates with ElevenLabs Text-to-Speech API
 */

import { TTSProvider } from './provider';

// ElevenLabs API error
export class ElevenLabsError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'ElevenLabsError';
  }
}

// ElevenLabs configuration
export const ELEVENLABS_CONFIG = {
  voiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', // Rachel voice
  model: 'eleven_monolingual_v1',
  voiceSettings: {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.5,
    use_speaker_boost: true
  },
  outputFormat: 'mp3_44100_128' // High quality MP3
} as const;

class ElevenLabsService implements TTSProvider {
  public readonly name = 'elevenlabs';
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';

  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable is required');
    }

    this.apiKey = apiKey;
  }

  /**
   * Generate speech from text using ElevenLabs
   * @param text - Text to convert to speech
   * @param options - Optional voice and settings overrides
   * @returns Audio buffer (MP3 format)
   */
  async generateSpeech(
    text: string,
    options?: {
      voiceId?: string;
      model?: string;
      voiceSettings?: typeof ELEVENLABS_CONFIG.voiceSettings;
    }
  ): Promise<Buffer> {
    const voiceId = options?.voiceId || ELEVENLABS_CONFIG.voiceId;
    const model = options?.model || ELEVENLABS_CONFIG.model;
    const voiceSettings = options?.voiceSettings || ELEVENLABS_CONFIG.voiceSettings;

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          },
          body: JSON.stringify({
            text,
            model_id: model,
            voice_settings: voiceSettings
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `ElevenLabs API error: ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail?.message || errorJson.message || errorMessage;
        } catch {
          // If not JSON, use status text
          errorMessage = errorText || response.statusText;
        }

        throw new ElevenLabsError(errorMessage, response.status);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof ElevenLabsError) {
        throw error;
      }

      throw new ElevenLabsError(
        `Failed to generate speech: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Check if ElevenLabs API is available
   * @returns True if API key is valid and service is accessible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get remaining character quota
   * @returns Number of characters remaining, or -1 if unlimited
   */
  async getQuotaRemaining(): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/user/subscription`, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        return -1;
      }

      const data = await response.json();
      const characterLimit = data.character_limit || 0;
      const characterCount = data.character_count || 0;

      return Math.max(0, characterLimit - characterCount);
    } catch {
      return -1;
    }
  }

  /**
   * Get available voices
   * @returns List of available voice IDs and names
   */
  async getVoices(): Promise<Array<{ voice_id: string; name: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new ElevenLabsError('Failed to fetch voices', response.status);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      if (error instanceof ElevenLabsError) {
        throw error;
      }

      throw new ElevenLabsError(
        `Failed to get voices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }
}

// Export singleton instance (created lazily to avoid errors when env var missing)
let elevenLabsInstance: ElevenLabsService | null = null;

export const getElevenLabs = (): ElevenLabsService => {
  if (!elevenLabsInstance) {
    elevenLabsInstance = new ElevenLabsService();
  }
  return elevenLabsInstance;
};

// Export class for testing
export { ElevenLabsService };
