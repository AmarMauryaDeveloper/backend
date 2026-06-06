import express from 'express';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/projectController.js';
import { protect, authorize } from '../middlewares/auth.js';
import { uploadAttachments } from '../middlewares/upload.js';

const router = express.Router();

// All routes require login
router.use(protect);

router.route('/')
  .get(getProjects)
  .post(authorize('Admin'), uploadAttachments, createProject);

router.route('/:id')
  .get(getProject)
  .put(uploadAttachments, updateProject) // Admin or User (User can only change status)
  .delete(authorize('Admin'), deleteProject);

export default router;
