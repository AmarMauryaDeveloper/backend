import User from '../models/User.js';
import ErrorResponse from '../utils/errorResponse.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createActivityLog } from '../services/logService.js';

// Helper to set refresh token in HttpOnly secure cookie
const sendTokenResponse = async (user, statusCode, res) => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshTokens.push(refreshToken);

  // Enforce maximum 5 active sessions
  if (user.refreshTokens.length > 5) {
    user.refreshTokens.shift();
  }

  await user.save();

  const options = {
    httpOnly: true,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  res
    .status(statusCode)
    .cookie('refreshToken', refreshToken, options)
    .json({
      success: true,
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isActive: user.isActive,
      },
    });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorResponse('Please provide email and password', 400));
  }

  try {
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    if (!user.isActive) {
      return next(new ErrorResponse('Your account is deactivated. Contact an admin.', 403));
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    await createActivityLog(user._id, 'LOGIN', null, `${user.name} logged in.`);
    await sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @desc    Refresh access token (Token Rotation & Reuse Detection)
// @route   POST /api/auth/refresh
// @access  Public
export const refresh = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    return next(new ErrorResponse('Refresh token not found', 401));
  }

  try {
    const user = await User.findOne({ refreshTokens: refreshToken });

    if (!user) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const compromisedUser = await User.findById(decoded.id);
        if (compromisedUser) {
          compromisedUser.refreshTokens = [];
          await compromisedUser.save();
        }
      } catch (err) {
        // Ignore jwt verification errors here
      }
      return next(new ErrorResponse('Invalid refresh token or token reuse detected', 401));
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);

    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();

    user.refreshTokens.push(newRefreshToken);
    await user.save();

    const options = {
      httpOnly: true,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    };

    res
      .status(200)
      .cookie('refreshToken', newRefreshToken, options)
      .json({
        success: true,
        accessToken: newAccessToken,
      });
  } catch (err) {
    return next(new ErrorResponse('Invalid or expired refresh token', 401));
  }
};

// @desc    Logout user & clear cookie
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  try {
    if (refreshToken && req.user) {
      const user = await User.findById(req.user._id);
      if (user) {
        user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
        await user.save();
      }
      await createActivityLog(req.user._id, 'LOGOUT', null, `${req.user.name} logged out.`);
    }

    res.clearCookie('refreshToken');
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Forgot Password Request (Mock Reset Link)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorResponse('Please provide email', 400));
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return next(new ErrorResponse('Email not registered', 404));
    }

    const resetToken = crypto.randomBytes(20).toString('hex');

    res.status(200).json({
      success: true,
      message: 'Mock password reset token generated successfully. Send this token to the reset endpoint.',
      resetToken,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Reset Password using token
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res, next) => {
  const { resetToken, password, email } = req.body;

  if (!resetToken || !password || !email) {
    return next(new ErrorResponse('Please provide token, email, and new password', 400));
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    user.password = password;
    user.refreshTokens = [];
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (err) {
    next(err);
  }
};
