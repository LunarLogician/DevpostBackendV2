import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/emailService.js';
import { storePendingRegistration, getPendingRegistration, deletePendingRegistration } from '../utils/pendingRegistrations.js';
import { setPasswordResetOTP, getPasswordResetOTP, deletePasswordResetOTP } from '../utils/passwordResetStorage.js';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register new user (Step 1: Send OTP)
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store pending registration (not in DB yet)
    storePendingRegistration(email, {
      name,
      email,
      password,
      otp,
      otpExpires,
      otpAttempts: 0
    });

    // Send verification email with OTP
    try {
      await sendVerificationEmail(email, name, otp);
      
      res.status(200).json({
        success: true,
        requiresVerification: true,
        message: 'Verification code sent! Please check your email and enter the 6-digit code.',
        data: {
          email,
          name
        }
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      deletePendingRegistration(email);
      res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during registration',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // All users in DB are already verified (verification happens before account creation)
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        isEmailVerified: user.isEmailVerified,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
};

// @desc    Verify OTP and complete registration (Step 2: Create Account)
// @route   POST /api/auth/verify-email
// @access  Public
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP code are required'
      });
    }

    // Get pending registration
    const pendingReg = getPendingRegistration(email);

    if (!pendingReg) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found or expired. Please register again.'
      });
    }

    // Check if OTP is expired
    if (Date.now() > pendingReg.otpExpires) {
      deletePendingRegistration(email);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please register again.'
      });
    }

    // Check rate limiting (max 5 attempts)
    if (pendingReg.otpAttempts >= 5) {
      deletePendingRegistration(email);
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please register again.'
      });
    }

    // Verify OTP
    if (pendingReg.otp !== otp) {
      pendingReg.otpAttempts += 1;
      storePendingRegistration(email, pendingReg);
      
      return res.status(400).json({
        success: false,
        message: `Invalid OTP code. ${5 - pendingReg.otpAttempts} attempts remaining.`
      });
    }

    // OTP is valid - Create the user account now
    const user = await User.create({
      name: pendingReg.name,
      email: pendingReg.email,
      password: pendingReg.password,
      isEmailVerified: true, // Already verified via OTP
      emailVerificationOTP: null,
      emailVerificationExpires: null
    });

    // Delete pending registration
    deletePendingRegistration(email);

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully! You can now login.',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        isEmailVerified: true,
        token: token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error completing registration',
      error: error.message
    });
  }
};

// @desc    Resend verification OTP (Public - for pending registrations)
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if there's a pending registration for this email
    const pendingReg = getPendingRegistration(email);

    if (!pendingReg) {
      // Check if user already exists in database (already verified)
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified. You can login now.'
        });
      }
      return res.status(404).json({
        success: false,
        message: 'No pending registration found for this email. Please register first.'
      });
    }

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update pending registration with new OTP
    setPendingRegistration(email, {
      ...pendingReg,
      otp,
      expiresAt: verificationExpires,
      attempts: 0 // Reset attempts
    });

    // Send verification email with new OTP
    try {
      await sendVerificationEmail(email, pendingReg.name, otp);
      
      res.json({
        success: true,
        message: 'New verification code sent! Please check your email.'
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resending OTP',
      error: error.message
    });
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Private
export const resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.emailVerificationOTP = otp;
    user.emailVerificationExpires = verificationExpires;
    user.otpAttempts = 0; // Reset attempts
    await user.save();

    // Send verification email with new OTP
    try {
      await sendVerificationEmail(user.email, user.name, otp);
      
      res.json({
        success: true,
        message: 'New verification code sent! Please check your email.'
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resending verification email',
      error: error.message
    });
  }
};

// @desc    Forgot password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists for security
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset code.'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in temporary storage
    setPasswordResetOTP(email, {
      otp,
      expiresAt,
      attempts: 0
    });

    // Send password reset email with OTP
    try {
      await sendPasswordResetEmail(user.email, user.name, otp);
      
      res.json({
        success: true,
        message: 'Password reset code sent! Please check your email.'
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      res.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again later.'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing forgot password request',
      error: error.message
    });
  }
};

// @desc    Verify reset OTP (Step 1 of password reset)
// @route   POST /api/auth/verify-reset-otp
// @access  Public
export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Get OTP data from temporary storage
    const resetData = getPasswordResetOTP(email);

    if (!resetData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code. Please request a new one.'
      });
    }

    // Check attempts limit
    if (resetData.attempts >= 5) {
      deletePasswordResetOTP(email);
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new reset code.'
      });
    }

    // Verify OTP
    if (resetData.otp !== otp) {
      resetData.attempts += 1;
      setPasswordResetOTP(email, resetData);
      
      return res.status(400).json({
        success: false,
        message: `Invalid reset code. ${5 - resetData.attempts} attempts remaining.`
      });
    }

    // Mark OTP as verified
    setPasswordResetOTP(email, {
      ...resetData,
      verified: true,
      verifiedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Code verified successfully! You can now reset your password.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying reset code',
      error: error.message
    });
  }
};

// @desc    Reset password with OTP (supports both one-step and two-step flow)
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Validation
    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Get OTP data from temporary storage
    const resetData = getPasswordResetOTP(email);

    if (!resetData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code. Please request a new one.'
      });
    }

    // Two-step flow: Check if OTP was already verified
    if (otp) {
      // One-step flow: Verify OTP now
      if (resetData.attempts >= 5) {
        deletePasswordResetOTP(email);
        return res.status(429).json({
          success: false,
          message: 'Too many failed attempts. Please request a new reset code.'
        });
      }

      if (resetData.otp !== otp) {
        resetData.attempts += 1;
        setPasswordResetOTP(email, resetData);
        
        return res.status(400).json({
          success: false,
          message: `Invalid reset code. ${5 - resetData.attempts} attempts remaining.`
        });
      }
    } else {
      // Two-step flow: OTP must have been verified already
      if (!resetData.verified) {
        return res.status(400).json({
          success: false,
          message: 'Please verify your reset code first.'
        });
      }
    }

    // Find user and update password
    const user = await User.findOne({ email });

    if (!user) {
      deletePasswordResetOTP(email);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    // Delete OTP from storage after successful reset
    deletePasswordResetOTP(email);

    res.json({
      success: true,
      message: 'Password reset successfully! You can now login with your new password.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};
