import User from '../models/User.js';
import ErrorResponse from '../utils/errorResponse.js';
import { createActivityLog } from '../services/logService.js';
import { createNotification } from '../services/notificationService.js';
import { isCloudinaryConfigured, cloudinary } from '../config/cloudinary.js';
import fs from 'fs';
import path from 'path';

// Helper to upload avatar file (either to Cloudinary or local fallback)
const uploadAvatarFile = async (file, req) => {
  if (isCloudinaryConfigured) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'avatars',
        resource_type: 'image',
      });
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return result.secure_url;
    } catch (uploadError) {
      console.error('Cloudinary avatar upload failed, using local fallback:', uploadError.message);
      const hostUrl = `${req.protocol}://${req.get('host')}`;
      return `${hostUrl}/uploads/${path.basename(file.path)}`;
    }
  } else {
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    return `${hostUrl}/uploads/${path.basename(file.path)}`;
  }
};


// @desc    Get all users (with pagination)
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const total = await User.countDocuments();
    const users = await User.find().skip(skip).limit(limit).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
export const createUser = async (req, res, next) => {
  const { name, email, password, role, avatar } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return next(new ErrorResponse('Email already registered', 400));
    }

    let avatarUrl = avatar || '';
    if (req.file) {
      avatarUrl = await uploadAvatarFile(req.file, req);
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'User',
      avatar: avatarUrl,
      isActive: true,
    });

    await createActivityLog(
      req.user._id,
      'USER_CREATE',
      null,
      `Admin created user: ${user.name} (${user.email})`
    );

    const admins = await User.find({ role: 'Admin', _id: { $ne: req.user._id } });
    for (const admin of admins) {
      await createNotification(
        req.user._id,
        admin._id,
        'New User Created',
        `A new user account was registered: ${user.name}`
      );
    }

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req, res, next) => {
  const { name, email, role, isActive, avatar } = req.body;

  try {
    let user = await User.findById(req.params.id);

    if (!user) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (isActive !== undefined) {
      user.isActive = isActive === 'true' || isActive === true;
    }
    
    if (req.file) {
      user.avatar = await uploadAvatarFile(req.file, req);
    } else if (avatar !== undefined) {
      user.avatar = avatar;
    }

    await user.save();

    await createActivityLog(
      req.user._id,
      'USER_UPDATE',
      null,
      `Admin updated user properties for: ${user.name}`
    );

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }

    await User.findByIdAndDelete(req.params.id);

    await createActivityLog(
      req.user._id,
      'USER_DELETE',
      null,
      `Admin deleted user: ${user.name} (${user.email})`
    );

    res.status(200).json({ success: true, message: 'User removed successfully' });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current user profile
// @route   GET /api/users/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Update own profile
// @route   PUT /api/users/profile
// @access  Private
export const updateMe = async (req, res, next) => {
  const { name, email, avatar } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (email) {
      if (email !== user.email) {
        const emailExists = await User.findOne({ email });
        if (emailExists) {
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return next(new ErrorResponse('Email already registered by another account', 400));
        }
        user.email = email;
      }
    }
    
    if (req.file) {
      user.avatar = await uploadAvatarFile(req.file, req);
    } else if (avatar !== undefined) {
      user.avatar = avatar;
    }

    await user.save();

    await createActivityLog(
      user._id,
      'USER_UPDATE',
      null,
      `User ${user.name} updated their own profile properties.`
    );

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
};

// @desc    Change own password
// @route   PUT /api/users/change-password
// @access  Private
export const updateMyPassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new ErrorResponse('Please provide current and new passwords', 400));
  }

  try {
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return next(new ErrorResponse('Incorrect current password', 401));
    }

    user.password = newPassword;
    user.refreshTokens = [];
    await user.save();

    await createActivityLog(
      user._id,
      'USER_UPDATE',
      null,
      `User ${user.name} changed their password.`
    );

    res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
};
