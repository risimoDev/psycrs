import type pino from 'pino';
import { LocalHLSProvider } from './local-hls.provider.js';
import { KinescopeProvider } from './kinescope.provider.js';
import type { IVideoProvider } from './video-provider.js';

export type { IVideoProvider } from './video-provider.js';
export type { UploadResult, ProcessingResult, DashProcessingResult, PlaybackInfo, HLSVariant } from './video-provider.js';

interface VideoProviderConfig {
  provider: string;
  storagePath: string;
  logger: pino.Logger;
}

/** Factory — creates the correct video provider based on configuration */
export function createVideoProvider(config: VideoProviderConfig): IVideoProvider {
  switch (config.provider) {
    case 'kinescope':
      return new KinescopeProvider({ logger: config.logger });

    case 'local':
    default:
      return new LocalHLSProvider({
        storagePath: config.storagePath,
        logger: config.logger,
      });
  }
}
