import { Router } from 'express';
import * as events from '../controllers/events.mjs';
import * as registrations from '../controllers/registrations.mjs';
import * as stats from '../controllers/stats.mjs';
import * as health from '../controllers/health.mjs';
import { validate } from '../middleware/validate.mjs';
import { idSchema, createEventSchema, updateEventSchema, registrationSchema } from '../validation/schemas.mjs';

export const router = Router();
router.get('/health', health.check);
router.get('/events', events.list);
router.post('/events', validate(createEventSchema, 'body'), events.create);
router.get('/events/:id', validate(idSchema, 'params'), events.detail);
router.patch('/events/:id', validate(idSchema, 'params'), validate(updateEventSchema, 'body'), events.update);
router.delete('/events/:id', validate(idSchema, 'params'), events.remove);
router.get('/events/:id/registrations', validate(idSchema, 'params'), registrations.list);
router.post('/events/:id/registrations', validate(idSchema, 'params'), validate(registrationSchema, 'body'), registrations.create);
router.get('/stats', stats.list);
