import express from 'express';
import { getProfile, updateProfile, getUsers, updateUser, deleteUser } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/me', protect, getProfile);
router.patch('/me', protect, updateProfile);
router.get('/', protect, isAdmin, getUsers);
router.patch('/:id', protect, isAdmin, updateUser);
router.delete('/:id', protect, isAdmin, deleteUser);

export default router;