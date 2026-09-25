import { Router } from 'express';

import { sendEmailHandler } from '../controllers/email.controller.js';
import { validate } from '../middleware/validate.js';
import { sendEmailSchema } from '../validators/email.schema.js';

const router = Router();

router.post('/', validate(sendEmailSchema), sendEmailHandler);

export default router;
