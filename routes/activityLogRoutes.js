import express from 'express';
import { getActivityLogs } from '../controllers/activityLogController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);
router.use(authorize('Admin'));

router.get('/', getActivityLogs);

export default router;
