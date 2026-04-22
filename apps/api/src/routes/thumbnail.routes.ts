import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createReadStream, existsSync } from 'node:fs';
import { join, normalize, resolve, extname } from 'node:path';
import { NotFoundError, ValidationError } from '../lib/errors.js';

const THUMBNAIL_DIR = resolve(process.cwd(), 'storage', 'thumbnails');

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

export async function thumbnailRoutes(app: FastifyInstance) {
  // Public — no auth required; thumbnails are presentational and non-sensitive.
  app.get('/:filename', async (request: FastifyRequest, reply: FastifyReply) => {
    const { filename } = request.params as { filename: string };

    // Reject path traversal attempts
    if (filename.includes('/') || filename.includes('..') || filename.includes('\0')) {
      throw new ValidationError('Invalid filename');
    }

    const filePath = normalize(join(THUMBNAIL_DIR, filename));
    if (!filePath.startsWith(THUMBNAIL_DIR)) {
      throw new ValidationError('Invalid filename');
    }

    if (!existsSync(filePath)) {
      throw new NotFoundError('Thumbnail');
    }

    const ext = extname(filename).toLowerCase();
    const contentType = MIME[ext] ?? 'application/octet-stream';

    return reply
      .header('Content-Type', contentType)
      .header('Cache-Control', 'public, max-age=2592000, immutable')
      .send(createReadStream(filePath));
  });
}
