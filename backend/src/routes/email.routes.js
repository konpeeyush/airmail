import { Router } from 'express';

import { sendEmailHandler } from '../controllers/email.controller.js';
import { uploadAttachments } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { sendEmailSchema } from '../validators/email.schema.js';

const router = Router();

// upload first: for multipart requests the text fields only exist in
// req.body once multer has parsed the form.
router.post('/', uploadAttachments, validate(sendEmailSchema), sendEmailHandler);

export default router;
