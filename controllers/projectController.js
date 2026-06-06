import Project from '../models/Project.js';
import User from '../models/User.js';
import ErrorResponse from '../utils/errorResponse.js';
import { isCloudinaryConfigured, cloudinary, uploadToCloudinary } from '../config/cloudinary.js';
import { createActivityLog } from '../services/logService.js';
import { createNotification } from '../services/notificationService.js';

// @desc    Get all projects (with Search, Filter, Sort, Pagination)
// @route   GET /api/projects
// @access  Private
export const getProjects = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    let query = {};

    if (req.user.role !== 'Admin') {
      query.assignedUsers = req.user._id;
    }

    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    if (req.query.status) query.status = req.query.status;
    if (req.query.priority) query.priority = req.query.priority;
    if (req.query.assignedUser) query.assignedUsers = req.query.assignedUser;

    let sortBy = { createdAt: -1 };
    if (req.query.sort === 'oldest') sortBy = { createdAt: 1 };
    else if (req.query.sort === 'endDate') sortBy = { endDate: 1 };

    const total = await Project.countDocuments(query);
    const projects = await Project.find(query)
      .populate('assignedUsers', 'name email avatar role')
      .populate('createdBy', 'name email')
      .sort(sortBy)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: projects.length,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      data: projects,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single project details
// @route   GET /api/projects/:id
// @access  Private
export const getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignedUsers', 'name email avatar role isActive')
      .populate('createdBy', 'name email');

    if (!project) {
      return next(new ErrorResponse(`Project not found with id of ${req.params.id}`, 404));
    }

    if (
      req.user.role !== 'Admin' &&
      !project.assignedUsers.some((u) => u._id.toString() === req.user._id.toString())
    ) {
      return next(new ErrorResponse('Not authorized to access this project', 403));
    }

    res.status(200).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
};

// @desc    Create project (Admin only)
// @route   POST /api/projects
// @access  Private/Admin
export const createProject = async (req, res, next) => {
  try {
    const { title, description, startDate, endDate, priority, assignedUsers } = req.body;

    let usersArray = [];
    if (assignedUsers) {
      usersArray = typeof assignedUsers === 'string' ? JSON.parse(assignedUsers) : assignedUsers;
    }

    const attachments = [];
    if (req.files && req.files.length > 0) {
      if (!isCloudinaryConfigured) {
        return next(new ErrorResponse('Cloudinary is not configured. File uploads are disabled.', 400));
      }
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer, 'project_saas', 'auto');
          attachments.push({
            name: file.originalname,
            secure_url: result.secure_url,
            public_id: result.public_id,
            size: file.size,
            mimeType: file.mimetype,
          });
        } catch (uploadError) {
          return next(new ErrorResponse(`Cloudinary upload failed: ${uploadError.message}`, 400));
        }
      }
    }

    const project = await Project.create({
      title,
      description,
      startDate,
      endDate,
      priority: priority || 'Medium',
      assignedUsers: usersArray,
      attachments,
      createdBy: req.user._id,
    });

    await createActivityLog(
      req.user._id,
      'PROJECT_CREATE',
      project._id,
      `Admin created project: "${project.title}"`
    );

    for (const userId of usersArray) {
      await createNotification(
        req.user._id,
        userId,
        'Project Assigned',
        `You have been assigned to project: "${project.title}"`
      );
    }

    res.status(201).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
};

// @desc    Update project (Admin: All fields / User: Status only)
// @route   PUT /api/projects/:id
// @access  Private
export const updateProject = async (req, res, next) => {
  try {
    let project = await Project.findById(req.params.id);

    if (!project) {
      return next(new ErrorResponse(`Project not found with id of ${req.params.id}`, 404));
    }

    if (req.user.role !== 'Admin') {
      const isAssigned = project.assignedUsers.some(
        (u) => u.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return next(new ErrorResponse('Not authorized to update this project status', 403));
      }

      const { status } = req.body;
      if (!status) {
        return next(new ErrorResponse('You can only update project status', 400));
      }

      const oldStatus = project.status;
      project.status = status;
      await project.save();

      await createActivityLog(
        req.user._id,
        'STATUS_CHANGE',
        project._id,
        `User changed status of "${project.title}" from "${oldStatus}" to "${status}"`
      );

      const admins = await User.find({ role: 'Admin' });
      for (const admin of admins) {
        await createNotification(
          req.user._id,
          admin._id,
          'Project Status Updated',
          `User "${req.user.name}" updated project "${project.title}" status to "${status}"`
        );
      }

      if (status === 'Completed') {
        for (const userId of project.assignedUsers) {
          if (userId.toString() !== req.user._id.toString()) {
            await createNotification(
              req.user._id,
              userId,
              'Project Completed',
              `Project "${project.title}" is completed!`
            );
          }
        }
      }

      return res.status(200).json({ success: true, data: project });
    }

    // Admin flow
    const { title, description, startDate, endDate, status, priority, assignedUsers } = req.body;

    let usersArray = project.assignedUsers;
    if (assignedUsers) {
      usersArray = typeof assignedUsers === 'string' ? JSON.parse(assignedUsers) : assignedUsers;
    }

    const attachments = [...project.attachments];
    if (req.files && req.files.length > 0) {
      if (!isCloudinaryConfigured) {
        return next(new ErrorResponse('Cloudinary is not configured. File uploads are disabled.', 400));
      }
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer, 'project_saas', 'auto');
          attachments.push({
            name: file.originalname,
            secure_url: result.secure_url,
            public_id: result.public_id,
            size: file.size,
            mimeType: file.mimetype,
          });
        } catch (uploadError) {
          return next(new ErrorResponse(`Cloudinary upload failed: ${uploadError.message}`, 400));
        }
      }
    }

    const oldAssigned = project.assignedUsers.map((u) => u.toString());
    const newAssigned = usersArray.map((u) => u.toString());
    const addedUsers = newAssigned.filter((u) => !oldAssigned.includes(u));
    const oldStatus = project.status;

    if (title) project.title = title;
    if (description) project.description = description;
    if (startDate) project.startDate = startDate;
    if (endDate) project.endDate = endDate;
    if (status) project.status = status;
    if (priority) project.priority = priority;
    project.assignedUsers = usersArray;
    project.attachments = attachments;

    await project.save();

    await createActivityLog(
      req.user._id,
      'PROJECT_UPDATE',
      project._id,
      `Admin updated properties for project: "${project.title}"`
    );

    for (const userId of addedUsers) {
      await createNotification(
        req.user._id,
        userId,
        'Project Assigned',
        `You have been assigned to project: "${project.title}"`
      );
    }

    if (status === 'Completed' && oldStatus !== 'Completed') {
      for (const userId of usersArray) {
        await createNotification(
          req.user._id,
          userId,
          'Project Completed',
          `Project "${project.title}" is completed!`
        );
      }
    }

    const updatedProject = await Project.findById(project._id)
      .populate('assignedUsers', 'name email avatar role')
      .populate('createdBy', 'name email');

    res.status(200).json({ success: true, data: updatedProject });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete Project (Admin only)
// @route   DELETE /api/projects/:id
// @access  Private/Admin
export const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return next(new ErrorResponse(`Project not found with id of ${req.params.id}`, 404));
    }

    for (const file of project.attachments) {
      if (file.public_id && isCloudinaryConfigured) {
        try {
          await cloudinary.uploader.destroy(file.public_id);
        } catch (error) {
          console.error(`Cloudinary deletion error: ${error.message}`);
        }
      }
    }

    await Project.findByIdAndDelete(req.params.id);

    await createActivityLog(
      req.user._id,
      'PROJECT_DELETE',
      null,
      `Admin deleted project: "${project.title}"`
    );

    for (const userId of project.assignedUsers) {
      await createNotification(
        req.user._id,
        userId,
        'Project Deleted',
        `The project: "${project.title}" you were assigned to has been deleted.`
      );
    }

    res.status(200).json({ success: true, message: 'Project removed successfully' });
  } catch (err) {
    next(err);
  }
};
