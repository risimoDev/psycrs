import { mkdir, access, readdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';
import type pino from 'pino';

import type {
  IVideoProvider,
  UploadResult,
  ProcessingResult,
  DashProcessingResult,
  HLSVariant,
} from './video-provider.js';
import { HLS_VARIANTS } from './video-provider.js';
import { VideoProcessingError } from '../../lib/errors.js';

const execFileAsync = promisify(execFile);

interface LocalHLSConfig {
  storagePath: string;
  logger: pino.Logger;
}

export class LocalHLSProvider implements IVideoProvider {
  private readonly storagePath: string;
  private readonly logger: pino.Logger;

  constructor(config: LocalHLSConfig) {
    this.storagePath = config.storagePath;
    this.logger = config.logger.child({ provider: 'local-hls' });
  }

  /** Upload raw video file to local storage */
  async uploadVideo(videoId: string, stream: Readable, filename: string): Promise<UploadResult> {
    const videoDir = this.getVideoDir(videoId);
    await mkdir(videoDir, { recursive: true });

    const ext = filename.substring(filename.lastIndexOf('.')) || '.mp4';
    const sourcePath = join(videoDir, `source${ext}`);

    const writeStream = createWriteStream(sourcePath);
    await pipeline(stream, writeStream);

    this.logger.info({ videoId, sourcePath }, 'Video uploaded');

    return { videoId, storagePath: sourcePath };
  }

  /** Transcode source video into multi-bitrate HLS using FFmpeg */
  async processToHLS(videoId: string): Promise<ProcessingResult> {
    const videoDir = this.getVideoDir(videoId);
    const sourcePath = await this.findSource(videoDir);

    // Generate AES-128 encryption key for this video
    const keyInfo = await this.generateEncryptionKey(videoId, videoDir);

    const completedVariants: string[] = [];

    for (const variant of HLS_VARIANTS) {
      try {
        await this.transcodeVariant(videoDir, sourcePath, variant, keyInfo);
        completedVariants.push(variant.name);
        this.logger.info({ videoId, variant: variant.name }, 'Variant transcoded');
      } catch (err) {
        this.logger.error({ videoId, variant: variant.name, err }, 'Variant transcoding failed');
        throw new VideoProcessingError(
          `Failed to transcode ${variant.name} for video ${videoId}`,
        );
      }
    }

    const masterPath = await this.generateMasterPlaylist(videoDir, completedVariants);

    this.logger.info({ videoId, variants: completedVariants }, 'HLS processing complete');

    return {
      videoId,
      variants: completedVariants,
      masterPlaylistPath: masterPath,
    };
  }

  /** Build internal path for Nginx X-Accel-Redirect */
  getPlaybackPath(videoId: string, variant: string, file: string): string {
    const safeParts = [videoId, variant, file].map((p) => this.sanitizePath(p));
    return `/protected/${safeParts.join('/')}`;
  }

  /** Check if master.m3u8 exists for this video */
  async isProcessed(videoId: string): Promise<boolean> {
    const masterPath = join(this.getVideoDir(videoId), 'master.m3u8');
    try {
      await access(masterPath);
      return true;
    } catch {
      return false;
    }
  }

  /** Check if DASH manifest exists for this video */
  async isDashProcessed(videoId: string): Promise<boolean> {
    const mpdPath = join(this.getVideoDir(videoId), 'dash', 'manifest.mpd');
    try {
      await access(mpdPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Package transcoded video into DASH+CENC using Shaka Packager.
   * Requires Shaka Packager binary (SHAKA_PACKAGER_PATH env var).
   * Transcodes intermediate MP4s, then packages with CENC encryption.
   */
  async processToDASH(
    videoId: string,
    keyId: string,
    key: string,
  ): Promise<DashProcessingResult> {
    const videoDir = this.getVideoDir(videoId);
    const sourcePath = await this.findSource(videoDir);
    const dashDir = join(videoDir, 'dash');
    await mkdir(dashDir, { recursive: true });

    // 1. Transcode intermediate MP4s for each variant
    const intermediates: { variant: HLSVariant; path: string }[] = [];
    for (const variant of HLS_VARIANTS) {
      const mp4Path = join(dashDir, `${variant.name}.mp4`);
      try {
        await access(mp4Path);
        this.logger.debug({ videoId, variant: variant.name }, 'Intermediate MP4 exists, skipping');
      } catch {
        await this.transcodeIntermediate(sourcePath, variant, mp4Path);
        this.logger.info({ videoId, variant: variant.name }, 'Intermediate MP4 transcoded');
      }
      intermediates.push({ variant, path: mp4Path });
    }

    // 2. Package with Shaka Packager using raw key (CENC) encryption
    const { SHAKA_PACKAGER_PATH } = await import('../../config/env.js').then((m) => m.getEnv());
    const mpdPath = join(dashDir, 'manifest.mpd');

    const inputArgs: string[] = [];
    for (const { variant, path: mp4Path } of intermediates) {
      inputArgs.push(
        `in=${mp4Path},stream=video,output=${join(dashDir, `${variant.name}_video.mp4`)}`,
      );
    }
    // Audio from the highest quality variant
    const bestVariant = intermediates[intermediates.length - 1]!;
    inputArgs.push(
      `in=${bestVariant.path},stream=audio,output=${join(dashDir, 'audio.mp4')}`,
    );

    const packagerArgs = [
      ...inputArgs,
      '--mpd_output', mpdPath,
      '--enable_raw_key_encryption',
      '--keys', `key_id=${keyId}:key=${key}`,
      '--clear_lead', '0',
      '--protection_scheme', 'cenc',
    ];

    try {
      const { stderr } = await execFileAsync(SHAKA_PACKAGER_PATH, packagerArgs, {
        timeout: 30 * 60 * 1000,
      });
      if (stderr) {
        this.logger.debug({ stderr: stderr.slice(-500) }, 'Shaka Packager stderr');
      }
    } catch (err) {
      this.logger.error({ err, videoId }, 'Shaka Packager failed');
      throw new VideoProcessingError(`DASH packaging failed for video ${videoId}`);
    }

    this.logger.info({ videoId }, 'DASH+CENC processing complete');
    return { videoId, mpdPath };
  }

  /** List available quality variants for a processed video */
  async getAvailableVariants(videoId: string): Promise<readonly string[]> {
    const videoDir = this.getVideoDir(videoId);
    try {
      const entries = await readdir(videoDir, { withFileTypes: true });
      const variants = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((name) => HLS_VARIANTS.some((v) => v.name === name));
      return variants;
    } catch {
      return [];
    }
  }

  // ─── Private ──────────────────────────────────────────

  private getVideoDir(videoId: string): string {
    return join(this.storagePath, this.sanitizePath(videoId));
  }

  private async findSource(videoDir: string): Promise<string> {
    const entries = await readdir(videoDir);
    const source = entries.find((f) => f.startsWith('source.'));
    if (!source) {
      throw new VideoProcessingError('Source video file not found');
    }
    return join(videoDir, source);
  }

  private async transcodeVariant(
    videoDir: string,
    sourcePath: string,
    variant: HLSVariant,
    keyInfo?: { keyPath: string; iv: string },
  ): Promise<void> {
    const variantDir = join(videoDir, variant.name);
    await mkdir(variantDir, { recursive: true });

    const outputPath = join(variantDir, 'index.m3u8');
    const segmentPattern = join(variantDir, 'segment%03d.ts');

    const args = [
      '-i', sourcePath,
      '-vf', `scale=${variant.width}:${variant.height}`,
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '23',
      '-maxrate', String(variant.bitrate),
      '-bufsize', String(variant.bitrate * 2),
      '-profile:v', 'high',
      '-level:v', '4.1',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-ac', '2',
      '-ar', '44100',
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_segment_filename', segmentPattern,
      '-hls_playlist_type', 'vod',
      '-movflags', '+faststart',
    ];

    // AES-128 encryption — generate per-variant keyinfo so URI resolves locally
    if (keyInfo) {
      const { copyFile } = await import('node:fs/promises');
      const variantKeyPath = join(variantDir, 'enc.key');
      await copyFile(keyInfo.keyPath, variantKeyPath);

      // key_info_file: URI (written into m3u8), local key path, IV
      const keyInfoContent = `enc.key\n${variantKeyPath}\n${keyInfo.iv}`;
      const variantKeyInfoPath = join(variantDir, 'enc.keyinfo');
      await writeFile(variantKeyInfoPath, keyInfoContent, 'utf-8');

      args.push('-hls_key_info_file', variantKeyInfoPath);
    }

    args.push('-y', outputPath);

    const { stderr } = await execFileAsync('ffmpeg', args, {
      timeout: 30 * 60 * 1000, // 30 min max
    });

    if (stderr) {
      this.logger.debug({ variant: variant.name, stderr: stderr.slice(-500) }, 'FFmpeg stderr');
    }
  }

  /** Transcode source to an intermediate fragmented MP4 (for Shaka Packager input) */
  private async transcodeIntermediate(
    sourcePath: string,
    variant: HLSVariant,
    outputPath: string,
  ): Promise<void> {
    const args = [
      '-i', sourcePath,
      '-vf', `scale=${variant.width}:${variant.height}`,
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '23',
      '-maxrate', String(variant.bitrate),
      '-bufsize', String(variant.bitrate * 2),
      '-profile:v', 'high',
      '-level:v', '4.1',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-ac', '2',
      '-ar', '44100',
      '-movflags', '+faststart',
      '-y', outputPath,
    ];

    await execFileAsync('ffmpeg', args, { timeout: 30 * 60 * 1000 });
  }

  private async generateMasterPlaylist(
    videoDir: string,
    variants: readonly string[],
  ): Promise<string> {
    const lines = ['#EXTM3U'];

    for (const variantName of variants) {
      const meta = HLS_VARIANTS.find((v) => v.name === variantName);
      if (!meta) continue;

      lines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${meta.bitrate},RESOLUTION=${meta.width}x${meta.height}`,
        `${variantName}/index.m3u8`,
      );
    }

    const masterPath = join(videoDir, 'master.m3u8');
    await writeFile(masterPath, lines.join('\n') + '\n', 'utf-8');
    return masterPath;
  }

  /**
   * Generate AES-128 encryption key for HLS segments.
   * Creates enc.key (16 random bytes) in the video directory.
   * Each variant will get a copy during transcoding.
   */
  private async generateEncryptionKey(
    videoId: string,
    videoDir: string,
  ): Promise<{ keyPath: string; iv: string }> {
    const key = randomBytes(16);
    const iv = randomBytes(16).toString('hex');

    const keyPath = join(videoDir, 'enc.key');
    await writeFile(keyPath, key);

    this.logger.info({ videoId }, 'AES-128 encryption key generated');
    return { keyPath, iv };
  }

  /** Prevent path traversal — strip anything except alphanumeric, dash, dot, underscore */
  private sanitizePath(segment: string): string {
    const sanitized = segment.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!sanitized || sanitized === '.' || sanitized === '..') {
      throw new VideoProcessingError(`Invalid path segment: ${segment}`);
    }
    return sanitized;
  }
}
