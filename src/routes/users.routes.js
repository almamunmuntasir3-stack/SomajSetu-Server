import { Router } from 'express';
import * as controller from '../controllers/users.controller.js';

const router = Router();

router.get('/:email/profile', controller.getUserProfile);
router.patch('/:email/profile', controller.updateUserProfile);

export default router;
