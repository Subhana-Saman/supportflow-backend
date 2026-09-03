import express from 'express';
import { getMessages, sendMessage } from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';
import { handleUpload } from '../middleware/uploadMiddleware.js';
import { validateMessage } from '../validators/messageValidator.js';

const router = express.Router();

router.get('/:id/messages', protect, getMessages);
router.post('/:id/messages', protect, handleUpload, validateMessage, sendMessage);

export default router;