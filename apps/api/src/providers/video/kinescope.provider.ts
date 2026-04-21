import type { Readable } from 'node:stream';
import type pino from 'pino';

import type {
  IVideoProvider,
  UploadResult,
  ProcessingResult,
  DashProcessingResult,
} from './video-provider.js';

interface KinescopeConfig {
  logger: pino.Logger;
}

/**
 * Kinescope provider stub.
 * Implements IVideoProvider for future integration with Kinescope API.
 * All methods throw — swap with real implementation when ready.
 */
export class KinescopeProvider implements IVideoProvider {
  private readonly logger: pino.Logger;

  constructor(config: KinescopeConfig) {
    this.logger = config.logger.child({ provider: 'kinescope' });
  }

  async uploadVideo(_videoId: string, _stream: Readable, _filename: string): Promise<UploadResult> {
    this.logger.warn('Kinescope uploadVideo called — not implemented');
    throw new Error('Kinescope provider not implemented');
  }

  async processToHLS(_videoId: string): Promise<ProcessingResult> {
    this.logger.warn('Kinescope processToHLS called — not implemented');
    throw new Error('Kinescope provider not implemented');
  }

  async processToDASH(_videoId: string, _keyId: string, _key: string): Promise<DashProcessingResult> {
    throw new Error('Kinescope provider not implemented');
  }

  getPlaybackPath(_videoId: string, _variant: string, _file: string): string {
    throw new Error('Kinescope provider not implemented');
  }

  async isProcessed(_videoId: string): Promise<boolean> {
    throw new Error('Kinescope provider not implemented');
  }

  async isDashProcessed(_videoId: string): Promise<boolean> {
    throw new Error('Kinescope provider not implemented');
  }

  async getAvailableVariants(_videoId: string): Promise<readonly string[]> {
    throw new Error('Kinescope provider not implemented');
  }
}
