import { Router } from 'express';

import emailRoutes from './email.routes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'ok' });
});

router.use('/emails', emailRoutes);

export default router;
