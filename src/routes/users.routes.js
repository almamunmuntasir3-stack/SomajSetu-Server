import { Router } from 'express';
import * as controller from '../controllers/users.controller.js';
import verifyJwt from '../middleware/verifyJwt.js';

const router = Router();

router.get('/:email/profile', verifyJwt, controller.getUserProfile);
router.patch('/:email/profile', verifyJwt, controller.updateUserProfile);

export default router;
