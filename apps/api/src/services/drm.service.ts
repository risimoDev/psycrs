import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getEnv } from '../config/env.js';
import { getLogger } from '../lib/logger.js';

/**
 * DRM key management and Clear Key server.
 *
 * When DRM_MODE=clearkey  — keys are generated locally and served via authenticated endpoint.
 * When DRM_MODE=widevine  — license requests are proxied to DRM_LICENSE_SERVER_URL.
 */

interface DrmKeyPair {
  /** 16-byte key ID as hex (no dashes) */
  keyId: string;
  /** 16-byte content encryption key as hex */
  key: string;
}

export class DrmService {
  private readonly logger = getLogger().child({ service: 'drm' });

  /** Get or create a stable DRM key pair for a video */
  async getOrCreateKeyPair(videoId: string): Promise<DrmKeyPair> {
    const env = getEnv();
    const keyDir = join(env.VIDEO_STORAGE_PATH, videoId, 'drm');
    const keyInfoPath = join(keyDir, 'keyinfo.json');

    try {
      await access(keyInfoPath);
      const raw = await readFile(keyInfoPath, 'utf-8');
      return JSON.parse(raw) as DrmKeyPair;
    } catch {
      // Generate new key pair
      const keyId = randomBytes(16).toString('hex');
      const key = randomBytes(16).toString('hex');
      const pair: DrmKeyPair = { keyId, key };

      await mkdir(keyDir, { recursive: true });
      await writeFile(keyInfoPath, JSON.stringify(pair), 'utf-8');
      this.logger.info({ videoId, keyId }, 'DRM key pair generated');
      return pair;
    }
  }

  /** Build Clear Key JSON response (W3C EME Clear Key format) */
  buildClearKeyResponse(keyId: string, key: string): object {
    return {
      keys: [
        {
          kty: 'oct',
          kid: this.hexToBase64url(keyId),
          k: this.hexToBase64url(key),
        },
      ],
      type: 'temporary',
    };
  }

  /** Derive key ID from videoId deterministically (for Shaka Packager) */
  deriveKeyId(videoId: string): string {
    return createHash('md5').update(`drm-kid:${videoId}`).digest('hex');
  }

  /** Derive content key from videoId + signing secret */
  deriveContentKey(videoId: string): string {
    const env = getEnv();
    return createHash('md5').update(`drm-cek:${videoId}:${env.VIDEO_SIGNING_SECRET}`).digest('hex');
  }

  private hexToBase64url(hex: string): string {
    return Buffer.from(hex, 'hex').toString('base64url');
  }
}

export const drmService = new DrmService();
