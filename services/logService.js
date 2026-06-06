import ActivityLog from '../models/ActivityLog.js';

/**
 * Creates an activity log entry in the database.
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Type of action (e.g., 'PROJECT_CREATE')
 * @param {string|null} [projectId=null] - Associated project ID
 * @param {string} details - Human-readable details of the operation
 */
export const createActivityLog = async (userId, action, projectId = null, details) => {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      project: projectId,
      details,
    });
  } catch (error) {
    console.error(`Failed to create activity log: ${error.message}`);
  }
};
