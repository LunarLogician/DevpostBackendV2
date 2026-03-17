import express from 'express';
import {
  createCheckoutSession,
  createCustomerPortal,
  getCurrentSubscription,
  handleWebhook
} from '../controllers/lemonsqueezyController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (require authentication)
router.post('/create-checkout', protect, createCheckoutSession);
router.post('/customer-portal', protect, createCustomerPortal);
router.get('/subscription', protect, getCurrentSubscription);

// Webhook route (public - no authentication)
// Note: This will be mounted differently in app.js to handle raw body
router.post('/webhook', handleWebhook);

export default router;
