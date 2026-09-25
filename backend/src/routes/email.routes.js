import { Router } from 'express';

import { sendEmailHandler } from '../controllers/email.controller.js';

const router = Router();

router.post('/', sendEmailHandler);

export default router;
