import { randomBytes, createHmac, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '../lib/prisma.js';
import { getEnv } from '../config/env.js';
import { getLogger } from '../lib/logger.js';
import {
  ForbiddenError,
  NotFoundError,
  TokenExpiredError,
  TokenInvalidError,
} from '../lib/errors.js';
import { createVideoProvider, type IVideoProvider } from '../providers/video/index.js';

interface PlaybackResult {
  playbackUrl: string;
  expiresAt: Date;
  drm?: {
    mode: 'clearkey' | 'widevine';
    dashUrl: string;
    clearKeys?: Record<string, string>; // keyId → key (base64url)
    widevineUrl?: string;
  };
}

interface TokenData {
  userId: string;
  videoId: string;
  expiresAt: number;
  nonce: string;
}

interface ValidateResult {
  internalPath: string;
  userId: string;
  videoId: string;
}

// ─── AES-256-GCM helpers ─────────────────────────────────

/** Derive a 32-byte AES key from the signing secret (deterministic) */
function deriveAesKey(secret: string): Buffer {
  return createHash('sha256').update(`aes-gcm:${secret}`).digest();
}

/** Derive a separate HMAC key for token signature */
function deriveHmacKey(secret: string): string {
  return createHash('sha256').update(`hmac:${secret}`).digest('hex');
}

/** Encrypt token payload with AES-256-GCM. Returns: iv.ciphertext.tag (base64url) */
function encryptPayload(data: TokenData, secret: string): string {
  const key = deriveAesKey(secret);
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

/** Decrypt AES-256-GCM encrypted payload. Returns parsed TokenData or throws. */
function decryptPayload(encryptedToken: string, secret: string): TokenData {
  const parts = encryptedToken.split('.');
  if (parts.length !== 3) throw new TokenInvalidError();

  const [ivB64, ctB64, tagB64] = parts;

  const iv = Buffer.from(ivB64!, 'base64url');
  const ciphertext = Buffer.from(ctB64!, 'base64url');
  const tag = Buffer.from(tagB64!, 'base64url');

  if (iv.length !== 12 || tag.length !== 16) throw new TokenInvalidError();

  const key = deriveAesKey(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let plaintext: string;
  try {
    plaintext = decipher.update(ciphertext).toString('utf-8') + decipher.final('utf-8');
  } catch {
    throw new TokenInvalidError();
  }

  return JSON.parse(plaintext) as TokenData;
}

export class VideoService {
  private readonly logger = getLogger().child({ service: 'video' });
  private provider: IVideoProvider | undefined;

  private getProvider(): IVideoProvider {
    if (!this.provider) {
      const env = getEnv();
      this.provider = createVideoProvider({
        provider: env.VIDEO_PROVIDER,
        storagePath: env.VIDEO_STORAGE_PATH,
        logger: getLogger(),
      });
    }
    return this.provider;
  }

  /** Request playback — verify subscription, generate signed URL */
  async requestPlayback(userId: string, lessonId: string, clientIp?: string): Promise<PlaybackResult> {
    // 1. Check active subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription || (subscription.status !== 'active' && subscription.status !== 'grace_period')) {
      throw new ForbiddenError('Active subscription required');
    }

    if (subscription.currentPeriodEnd < new Date()) {
      throw new ForbiddenError('Subscription expired');
    }

    // 2. Find lesson
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundError('Lesson');
    }

    if (!lesson.videoId) {
      throw new NotFoundError('Lesson has no video assigned');
    }

    // 3. Check video is processed
    const provider = this.getProvider();
    const processed = await provider.isProcessed(lesson.videoId);
    if (!processed) {
      throw new NotFoundError('Video not available yet');
    }

    // 4. Generate signed token
    const env = getEnv();
    const ttlMs = env.VIDEO_TOKEN_TTL_MINUTES * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const nonce = randomBytes(16).toString('hex');

    const tokenData: TokenData = {
      userId,
      videoId: lesson.videoId,
      expiresAt: expiresAt.getTime(),
      nonce,
    };

    // Encrypt payload with AES-256-GCM (prevents decoding userId/videoId)
    const encryptedPayload = encryptPayload(tokenData, env.VIDEO_SIGNING_SECRET);
    // HMAC signature over the encrypted payload for fast rejection
    const signature = createHmac('sha256', deriveHmacKey(env.VIDEO_SIGNING_SECRET))
      .update(encryptedPayload)
      .digest('base64url');

    const token = `${encryptedPayload}.${signature}`;

    // 5. Store hash in DB (for revocation/replay protection)
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await prisma.videoToken.create({
      data: {
        userId,
        tokenHash,
        issuedIp: clientIp ?? null,
        expiresAt,
      },
    });

    this.logger.debug({ userId, videoId: lesson.videoId }, 'Playback token issued');

    const result: PlaybackResult = {
      playbackUrl: `/video/play?token=${token}`,
      expiresAt,
    };

    // DRM: attach DASH info when DRM is enabled and DASH is available
    if (env.DRM_ENABLED) {
      const { drmService } = await import('./drm.service.js');
      const provider = this.getProvider();
      const dashReady = await provider.isDashProcessed(lesson.videoId);

      if (dashReady) {
        const keyId = drmService.deriveKeyId(lesson.videoId);
        const contentKey = drmService.deriveContentKey(lesson.videoId);

        result.drm = {
          mode: env.DRM_MODE,
          dashUrl: `/video/play?token=${token}&file=dash/manifest.mpd`,
          ...(env.DRM_MODE === 'clearkey'
            ? {
                clearKeys: {
                  [Buffer.from(keyId, 'hex').toString('base64url')]:
                    Buffer.from(contentKey, 'hex').toString('base64url'),
                },
              }
            : {}),
          ...(env.DRM_MODE === 'widevine' && env.DRM_LICENSE_SERVER_URL
            ? { widevineUrl: `/video/license?token=${token}` }
            : {}),
        };
      }
    }

    return result;
  }

  /** Validate a signed video token and return the internal path for X-Accel-Redirect */
  async validateAndGetPath(
    token: string,
    file: string,
    clientIp?: string,
    userAgent?: string,
  ): Promise<ValidateResult> {
    const env = getEnv();

    // 1. Split encrypted payload from HMAC signature
    // Format: iv.ciphertext.tag.hmacSignature (last dot separates HMAC)
    const lastDot = token.lastIndexOf('.');
    if (lastDot === -1) throw new TokenInvalidError();

    const encryptedPayload = token.slice(0, lastDot);
    const signature = token.slice(lastDot + 1);

    // 2. Verify HMAC signature (fast rejection of tampered tokens)
    const expectedSig = createHmac('sha256', deriveHmacKey(env.VIDEO_SIGNING_SECRET))
      .update(encryptedPayload)
      .digest('base64url');

    if (signature !== expectedSig) {
      throw new TokenInvalidError();
    }

    // 3. Decrypt AES-GCM payload
    const data = decryptPayload(encryptedPayload, env.VIDEO_SIGNING_SECRET);

    // 4. Check expiry
    if (Date.now() > data.expiresAt) {
      throw new TokenExpiredError();
    }

    // 5. Check token hash exists in DB (not revoked)
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const stored = await prisma.videoToken.findFirst({
      where: { tokenHash },
    });

    if (!stored) {
      throw new TokenInvalidError();
    }

    if (stored.revokedAt) {
      throw new TokenInvalidError();
    }

    if (stored.expiresAt < new Date()) {
      throw new TokenExpiredError();
    }

    // 5. IP pinning — if token was issued with an IP, verify it matches
    if (stored.issuedIp && clientIp && stored.issuedIp !== clientIp) {
      this.logger.warn(
        { tokenHash, issuedIp: stored.issuedIp, clientIp },
        'Token IP mismatch — possible token theft',
      );
      throw new ForbiddenError('Token bound to a different IP');
    }

    // 6. Build internal path
    const provider = this.getProvider();
    const requestedFile = file || 'master.m3u8';

    // Determine variant from file path (e.g., "720p/index.m3u8" or "720p/segment001.ts")
    const parts = requestedFile.split('/');
    let variant = '';
    let filename = requestedFile;

    if (parts.length === 2) {
      variant = parts[0] ?? '';
      filename = parts[1] ?? '';
    }

    const internalPath = variant
      ? provider.getPlaybackPath(data.videoId, variant, filename)
      : `/protected/${data.videoId}/${requestedFile}`;

    this.logger.debug(
      { videoId: data.videoId, path: internalPath },
      'Video access granted',
    );

    // 7. Audit log — fire-and-forget (don't block playback)
    prisma.videoAccessLog.create({
      data: {
        userId: data.userId,
        videoId: data.videoId,
        file: requestedFile,
        ip: clientIp ?? null,
        userAgent: userAgent ?? null,
      },
    }).catch((err) => {
      this.logger.error({ err }, 'Failed to write video access log');
    });

    return { internalPath, userId: data.userId, videoId: data.videoId };
  }

  /**
   * Read an HLS playlist (.m3u8) from disk, rewrite all relative URIs so they
   * point back to /video/play?token=<token>&file=<path>.
   *
   * HLS.js resolves relative URLs based on the base URL of the containing playlist.
   * Since the API uses query params (?file=...) the browser can't derive the correct
   * base path automatically, so we must rewrite every URI explicitly.
   */
  async servePlaylist(
    token: string,
    file: string,
    playBaseUrl: string, // e.g. "https://example.com/api/video/play"
    clientIp?: string,
    userAgent?: string,
  ): Promise<string> {
    const { videoId } = await this.validateAndGetPath(token, file, clientIp, userAgent);

    const env = getEnv();
    const filePath = join(env.VIDEO_STORAGE_PATH, videoId, file);
    const content = await readFile(filePath, 'utf-8');

    // Base directory for relative paths inside this playlist
    // e.g. file="360p/index.m3u8" → dir="360p/"
    const slashIdx = file.lastIndexOf('/');
    const dir = slashIdx !== -1 ? file.slice(0, slashIdx + 1) : '';

    const encodedToken = encodeURIComponent(token);

    const rewritten = content
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed === '') return line;

        // Rewrite URI="..." in EXT-X-KEY tag (AES-128 encryption key)
        if (trimmed.startsWith('#EXT-X-KEY')) {
          return trimmed.replace(/URI="([^"]+)"/, (_match, uri: string) => {
            if (uri.startsWith('http') || uri.startsWith('/')) return `URI="${uri}"`;
            const fullFile = encodeURIComponent(dir + uri);
            return `URI="${playBaseUrl}?token=${encodedToken}&file=${fullFile}"`;
          });
        }

        // Leave all other tags untouched
        if (trimmed.startsWith('#')) return line;

        // Rewrite relative segment/playlist paths
        if (!trimmed.startsWith('http') && !trimmed.startsWith('/')) {
          const fullFile = encodeURIComponent(dir + trimmed);
          return `${playBaseUrl}?token=${encodedToken}&file=${fullFile}`;
        }

        return line;
      })
      .join('\n');

    this.logger.debug({ videoId, file }, 'Playlist rewritten');
    return rewritten;
  }

  /** Get all lessons (for course page) */
  async getLessons() {
    return prisma.lesson.findMany({
      where: { isPublished: true },
      orderBy: [{ module: 'asc' }, { order: 'asc' }],
      select: { id: true, title: true, slug: true, order: true, module: true },
    });
  }

  /** Revoke all active video tokens for a user (e.g. on subscription cancel) */
  async revokeTokensForUser(userId: string): Promise<number> {
    const result = await prisma.videoToken.updateMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    this.logger.info({ userId, count: result.count }, 'Video tokens revoked');
    return result.count;
  }
}

export const videoService = new VideoService();
