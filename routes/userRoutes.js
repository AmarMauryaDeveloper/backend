import express from 'express';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getMe,
  updateMe,
  updateMyPassword,
} from '../controllers/userController.js';
import { protect, authorize } from '../middlewares/auth.js';
import { uploadAvatar } from '../middlewares/upload.js';

const router = express.Router();

// All routes here require protection
router.use(protect);

router.get('/me', getMe);
router.put('/profile', uploadAvatar, updateMe);
router.put('/change-password', updateMyPassword);

// Admin only routes
router.route('/')
  .get(authorize('Admin'), getUsers)
  .post(authorize('Admin'), uploadAvatar, createUser);

router.route('/:id')
  .get(authorize('Admin'), getUser)
  .put(authorize('Admin'), uploadAvatar, updateUser)
  .delete(authorize('Admin'), deleteUser);

export default router;
