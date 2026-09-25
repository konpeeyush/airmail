import { Router } from 'express';

import { sendEmailHandler } from '../controllers/email.controller.js';
import { emailRateLimiter } from '../middleware/rateLimit.js';
import { uploadAttachments } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { sendEmailSchema } from '../validators/email.schema.js';

const router = Router();

// rate limit → parse upload → validate → send.
// Upload runs before validate: for multipart requests the text fields only
// exist in req.body once multer has parsed the form.
router.post('/', emailRateLimiter, uploadAttachments, validate(sendEmailSchema), sendEmailHandler);

export default router;
