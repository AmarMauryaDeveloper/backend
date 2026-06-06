import Notification from '../models/Notification.js';
import ErrorResponse from '../utils/errorResponse.js';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ receiver: req.user._id })
      .populate('sender', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      receiver: req.user._id,
      read: false,
    });

    res.status(200).json({ success: true, unreadCount, data: notifications });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res, next) => {
  try {
    let notification = await Notification.findById(req.params.id);

    if (!notification) {
      return next(new ErrorResponse(`Notification not found with id of ${req.params.id}`, 404));
    }

    if (notification.receiver.toString() !== req.user._id.toString()) {
      return next(new ErrorResponse('Not authorized to access this notification', 403));
    }

    notification.read = true;
    await notification.save();

    res.status(200).json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { receiver: req.user._id, read: false },
      { $set: { read: true } }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};
