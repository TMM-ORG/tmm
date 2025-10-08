/**
 * TTS Provider Interface
 * Defines the contract for TTS service providers
 */

export interface TTSProvider {
  name: string;

  /**
   * Generate speech from text
   * @param text - Text to convert to speech
   * @param options - Provider-specific options
   * @returns Audio buffer
   */
  generateSpeech(text: string, options?: any): Promise<Buffer>;

  /**
   * Check if provider is available and has quota
   * @returns True if provider can be used
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get remaining quota/credits
   * @returns Number of remaining credits/characters, or -1 if unlimited
   */
  getQuotaRemaining(): Promise<number>;
}

export interface AudioGenerationResult {
  audioBuffer: Buffer;
  provider: string;
  voice: string;
  duration: number;
  sizeBytes: number;
}
