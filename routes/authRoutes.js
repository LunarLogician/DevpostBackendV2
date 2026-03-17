import express from 'express';
import { register, login, getMe, verifyEmail, resendVerification, resendOTP, forgotPassword, verifyResetOTP, resetPassword } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOTP);
router.post('/resend-verification', protect, resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);

export default router;
