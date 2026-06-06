import ActivityLog from '../models/ActivityLog.js';
import User from '../models/User.js';
import ErrorResponse from '../utils/errorResponse.js';

// @desc    Get activity logs (Admin only, with search and pagination)
// @route   GET /api/activity-logs
// @access  Private/Admin
export const getActivityLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    let query = {};

    if (req.query.search) {
      const users = await User.find({
        $or: [
          { name: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
        ],
      }).select('_id');

      const userIds = users.map((u) => u._id);

      query.$or = [
        { details: { $regex: req.query.search, $options: 'i' } },
        { action: { $regex: req.query.search, $options: 'i' } },
        { user: { $in: userIds } },
      ];
    }

    const total = await ActivityLog.countDocuments(query);
    const logs = await ActivityLog.find(query)
      .populate('user', 'name email role avatar')
      .populate('project', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: logs.length,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      data: logs,
    });
  } catch (err) {
    next(err);
  }
};
