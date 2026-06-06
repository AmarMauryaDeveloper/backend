import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'PROJECT_CREATE',
      'PROJECT_UPDATE',
      'PROJECT_DELETE',
      'STATUS_CHANGE',
      'USER_CREATE',
      'USER_UPDATE',
      'USER_DELETE',
      'FILE_UPLOAD',
      'LOGIN',
      'LOGOUT',
    ],
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null,
  },
  details: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
