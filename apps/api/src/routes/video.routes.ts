import type { FastifyInstance } from 'fastify';
import { videoController } from '../controllers/video.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export async function videoRoutes(app: FastifyInstance) {
  // Request signed playback URL (requires auth + subscription)
  app.post(
    '/request-playback',
    { preHandler: [requireAuth] },
    (req, reply) => videoController.requestPlayback(req, reply),
  );

  // Serve HLS via X-Accel-Redirect (token validated, no auth header needed)
  app.get('/play', (req, reply) => videoController.play(req, reply));

  // Widevine license proxy (token validated)
  app.post('/license', (req, reply) => videoController.licenseProxy(req, reply));

  // List all lessons
  app.get(
    '/lessons',
    { preHandler: [requireAuth] },
    (req, reply) => videoController.lessons(req, reply),
  );
}
