import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { videoService } from '../services/video.service.js';
import { drmService } from '../services/drm.service.js';
import { getEnv } from '../config/env.js';
import { ValidationError, ForbiddenError, TokenInvalidError } from '../lib/errors.js';

const requestPlaybackSchema = z.object({
  lessonId: z.string().uuid(),
});

export class VideoController {
  /** Request a signed playback URL. Requires active subscription. */
  async requestPlayback(request: FastifyRequest, reply: FastifyReply) {
    const parsed = requestPlaybackSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Validation failed');
    }

    const clientIp = request.ip ?? (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
    const result = await videoService.requestPlayback(
      request.userId,
      parsed.data.lessonId,
      clientIp,
    );

    return reply.send(result);
  }

  /** Serve HLS video via Nginx X-Accel-Redirect (token in query). */
  async play(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as Record<string, string>;
    const token = query['token'];
    const file = query['file'] ?? 'master.m3u8';

    if (!token) {
      throw new TokenInvalidError();
    }

    const clientIp = request.ip ?? (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
    const userAgent = request.headers['user-agent'];

    // ── HLS playlists must be rewritten so every relative URI points back to
    // this endpoint with the token param, instead of being resolved relative to
    // the browser's view of the URL (which loses the ?file= routing).
    if (file.endsWith('.m3u8')) {
      const env = getEnv();
      // Build the public URL for this endpoint that HLS.js will use as base
      const publicApiUrl = env.PUBLIC_API_URL.replace(/\/$/, '');
      const playBaseUrl = publicApiUrl
        ? `${publicApiUrl}/video/play`
        : `${request.headers['x-forwarded-proto'] ?? 'https'}://${request.headers.host}/api/video/play`;

      const content = await videoService.servePlaylist(token, file, playBaseUrl, clientIp, userAgent);

      return reply
        .header('Content-Type', 'application/vnd.apple.mpegurl')
        .header('Cache-Control', 'no-store')
        .header('Access-Control-Allow-Origin', '*')
        .send(content);
    }

    // Segments (.ts) and encryption keys (.key) — serve efficiently via Nginx X-Accel-Redirect
    const { internalPath } = await videoService.validateAndGetPath(token, file, clientIp, userAgent);

    return reply
      .header('X-Accel-Redirect', internalPath)
      .header('Content-Type', file.endsWith('.ts') ? 'video/MP2T' : 'application/octet-stream')
      .header('Cache-Control', 'no-store')
      .status(200)
      .send();
  }

  /** Widevine license proxy — forwards license requests to the configured DRM server. */
  async licenseProxy(request: FastifyRequest, reply: FastifyReply) {
    const env = getEnv();
    if (!env.DRM_ENABLED || env.DRM_MODE !== 'widevine') {
      throw new ForbiddenError('DRM not configured');
    }

    const query = request.query as Record<string, string>;
    const token = query['token'];

    if (!token) {
      throw new TokenInvalidError();
    }

    const clientIp = request.ip ?? (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
    const userAgent = request.headers['user-agent'];

    // Validate token before proxying to DRM server
    await videoService.validateAndGetPath(token, 'dash/manifest.mpd', clientIp, userAgent);

    if (env.DRM_MODE === 'widevine' && env.DRM_LICENSE_SERVER_URL) {
      // Forward license request to the DRM server
      const licenseRes = await fetch(env.DRM_LICENSE_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: request.body as Buffer,
      });

      const licenseData = await licenseRes.arrayBuffer();
      return reply
        .status(licenseRes.status)
        .header('Content-Type', 'application/octet-stream')
        .send(Buffer.from(licenseData));
    }

    // Clear Key mode — serve key locally
    const query2 = request.query as Record<string, string>;
    const videoId = query2['videoId'];
    if (!videoId) throw new ValidationError('videoId required');

    const keyId = drmService.deriveKeyId(videoId);
    const key = drmService.deriveContentKey(videoId);
    return reply.send(drmService.buildClearKeyResponse(keyId, key));
  }

  /** List all published lessons for the course page. */
  async lessons(_request: FastifyRequest, reply: FastifyReply) {
    const items = await videoService.getLessons();
    return reply.send(items);
  }
}

export const videoController = new VideoController();
