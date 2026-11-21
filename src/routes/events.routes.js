import { Router } from 'express';
import * as controller from '../controllers/events.controller.js';

const router = Router();

// Static paths must be declared before /:id.
router.get('/upcoming', controller.getUpcomingEvents);
router.get('/latest', controller.getLatestEvents);

router.get('/:id', controller.getEventById);
router.post('/', controller.createEvent);
router.patch('/:id', controller.updateEvent);
router.delete('/:id', controller.deleteEvent);
router.post('/:id/join', controller.joinEvent);
router.post('/:id/leave', controller.leaveEvent);

export default router;
