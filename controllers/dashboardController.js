import Project from '../models/Project.js';
import User from '../models/User.js';
import ErrorResponse from '../utils/errorResponse.js';

// @desc    Get dashboard metrics and charts data
// @route   GET /api/dashboard
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'Admin';
    const scopeQuery = isAdmin ? {} : { assignedUsers: req.user._id };

    const totalUsers = isAdmin ? await User.countDocuments() : 1;
    const totalProjects = await Project.countDocuments(scopeQuery);
    const pendingProjects = await Project.countDocuments({ ...scopeQuery, status: 'Pending' });
    const inProgressProjects = await Project.countDocuments({ ...scopeQuery, status: 'In Progress' });
    const completedProjects = await Project.countDocuments({ ...scopeQuery, status: 'Completed' });

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const now = new Date();

    const endingSoonProjects = await Project.countDocuments({
      ...scopeQuery,
      status: { $ne: 'Completed' },
      endDate: { $gte: now, $lte: sevenDaysFromNow },
    });

    const statusDistribution = [
      { name: 'Pending', value: pendingProjects },
      { name: 'In Progress', value: inProgressProjects },
      { name: 'Completed', value: completedProjects },
    ];

    const monthlyStats = [];
    const monthsName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const monthLabel = `${monthsName[monthIndex]} ${year}`;

      const startOfMonth = new Date(year, monthIndex, 1);
      const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

      const createdCount = await Project.countDocuments({
        ...scopeQuery,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      const completedCount = await Project.countDocuments({
        ...scopeQuery,
        status: 'Completed',
        updatedAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      monthlyStats.push({ month: monthLabel, created: createdCount, completed: completedCount });
    }

    const priorityBreakdown = [
      { name: 'Low', value: await Project.countDocuments({ ...scopeQuery, priority: 'Low' }) },
      { name: 'Medium', value: await Project.countDocuments({ ...scopeQuery, priority: 'Medium' }) },
      { name: 'High', value: await Project.countDocuments({ ...scopeQuery, priority: 'High' }) },
      { name: 'Critical', value: await Project.countDocuments({ ...scopeQuery, priority: 'Critical' }) },
    ];

    res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalUsers,
          totalProjects,
          pendingProjects,
          inProgressProjects,
          completedProjects,
          endingSoonProjects,
        },
        charts: { statusDistribution, monthlyStats, priorityBreakdown },
      },
    });
  } catch (err) {
    next(err);
  }
};
