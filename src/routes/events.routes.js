import { Router } from 'express';
import * as controller from '../controllers/events.controller.js';
import verifyJwt from '../middleware/verifyJwt.js';

const router = Router();

// Public reads. Static paths must be declared before /:id.
router.get('/upcoming', controller.getUpcomingEvents);
router.get('/latest', controller.getLatestEvents);

// Authenticated reads: the current user's future joined events.
router.get('/joined-events', verifyJwt, controller.getJoinedEvents);
router.get('/joined', verifyJwt, controller.getJoinedEvents);

router.get('/:id', controller.getEventById);

router.post('/', verifyJwt, controller.createEvent);
router.patch('/:id', verifyJwt, controller.updateEvent);
router.delete('/:id', verifyJwt, controller.deleteEvent);
router.post('/:id/join', verifyJwt, controller.joinEvent);
router.post('/:id/leave', verifyJwt, controller.leaveEvent);

export default router;
