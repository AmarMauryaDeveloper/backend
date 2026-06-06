import Notification from '../models/Notification.js';
import { sendToUser } from '../sockets/socketHandler.js';

/**
 * Creates a notification in the database and sends a real-time Socket.io alert.
 * @param {string} senderId - ID of the user triggering the notification (can be null for system)
 * @param {string} receiverId - ID of the user receiving the notification
 * @param {string} title - Title of the notification
 * @param {string} message - Message body of the notification
 */
export const createNotification = async (senderId, receiverId, title, message) => {
  try {
    const notification = await Notification.create({
      sender: senderId,
      receiver: receiverId,
      title,
      message,
    });

    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'name email avatar')
      .lean();

    sendToUser(receiverId, 'notification', populatedNotification);

    return populatedNotification;
  } catch (error) {
    console.error(`Failed to create notification: ${error.message}`);
  }
};
