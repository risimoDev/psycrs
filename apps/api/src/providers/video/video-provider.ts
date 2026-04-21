import type { Readable } from 'node:stream';

/** Quality variant for HLS transcoding */
export interface HLSVariant {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly bitrate: number;
}

/** Result of a video upload operation */
export interface UploadResult {
  readonly videoId: string;
  readonly storagePath: string;
}

/** Result of HLS transcoding */
export interface ProcessingResult {
  readonly videoId: string;
  readonly variants: readonly string[];
  readonly masterPlaylistPath: string;
}

/** Result of DASH+CENC packaging */
export interface DashProcessingResult {
  readonly videoId: string;
  readonly mpdPath: string;
}

/** Signed playback URL data */
export interface PlaybackInfo {
  readonly url: string;
  readonly expiresAt: Date;
}

/** Abstraction over video hosting / delivery backends */
export interface IVideoProvider {
  /** Upload a raw video file and return its storage identifier */
  uploadVideo(videoId: string, stream: Readable, filename: string): Promise<UploadResult>;

  /** Transcode source video into HLS multi-bitrate segments */
  processToHLS(videoId: string): Promise<ProcessingResult>;

  /** Package transcoded variants into DASH+CENC for DRM playback */
  processToDASH(videoId: string, keyId: string, key: string): Promise<DashProcessingResult>;

  /** Build internal path for Nginx X-Accel-Redirect (or external URL for hosted providers) */
  getPlaybackPath(videoId: string, variant: string, file: string): string;

  /** Check if a video exists and has been processed */
  isProcessed(videoId: string): Promise<boolean>;

  /** Check if DASH output exists for this video */
  isDashProcessed(videoId: string): Promise<boolean>;

  /** List available quality variants for a processed video */
  getAvailableVariants(videoId: string): Promise<readonly string[]>;
}

/** Standard HLS quality presets — optimized for cost/quality balance.
 *  No 4K/1440p — overkill for educational content.
 *  CRF-equivalent bitrates tuned for talking-head / screencast. */
export const HLS_VARIANTS: readonly HLSVariant[] = [
  { name: '360p', width: 640, height: 360, bitrate: 600_000 },
  { name: '480p', width: 854, height: 480, bitrate: 1_000_000 },
  { name: '720p', width: 1280, height: 720, bitrate: 2_000_000 },
] as const;
