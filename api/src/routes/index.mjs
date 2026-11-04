import { Router } from 'express';
import * as events from '../controllers/events.mjs';
import * as registrations from '../controllers/registrations.mjs';
import * as stats from '../controllers/stats.mjs';
import * as health from '../controllers/health.mjs';
import { validate } from '../middleware/validate.mjs';
import { cached } from '../middleware/cached.mjs';
import { cacheKeys } from '../cache/index.mjs';
import { idSchema, createEventSchema, updateEventSchema, registrationSchema } from '../validation/schemas.mjs';

// Cache keys use the validated id (a number), so /events/1 and /events/01 share one entry.
const eventId = (req) => req.validated.params.id;

export const router = Router();
// Health is never cached: it must show the real state right now.
router.get('/health', health.check);
router.get('/events', cached(() => cacheKeys.eventList()), events.list);
router.post('/events', validate(createEventSchema, 'body'), events.create);
router.get('/events/:id', validate(idSchema, 'params'), cached((req) => cacheKeys.event(eventId(req))), events.detail);
router.patch('/events/:id', validate(idSchema, 'params'), validate(updateEventSchema, 'body'), events.update);
router.delete('/events/:id', validate(idSchema, 'params'), events.remove);
router.get('/events/:id/registrations', validate(idSchema, 'params'),
  cached((req) => cacheKeys.registrations(eventId(req))), registrations.list);
router.post('/events/:id/registrations', validate(idSchema, 'params'), validate(registrationSchema, 'body'), registrations.create);
router.get('/stats', cached(() => cacheKeys.stats()), stats.list);
