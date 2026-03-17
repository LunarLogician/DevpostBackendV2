import { lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js';
import User from '../models/User.js';
import crypto from 'crypto';

// Initialize Lemon Squeezy
const configureLemonSqueezy = () => {
  lemonSqueezySetup({
    apiKey: process.env.LEMONSQUEEZY_API_KEY,
    onError: (error) => {
      console.error('Lemon Squeezy Error:', error);
      throw new Error(`Lemon Squeezy API Error: ${error.message}`);
    },
  });
};

// Create checkout session for subscription
export const createCheckoutSession = async (req, res) => {
  try {
    configureLemonSqueezy();
    const { plan } = req.body; // 'starter' or 'pro'
    const userId = req.user.id;

    // Validate plan
    if (!['starter', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Choose starter or pro.' });
    }

    // Get variant ID based on plan
    const variantId = plan === 'starter' 
      ? process.env.LEMONSQUEEZY_STARTER_VARIANT_ID 
      : process.env.LEMONSQUEEZY_PRO_VARIANT_ID;

    if (!variantId) {
      return res.status(500).json({ error: 'Plan variant not configured' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has active subscription
    if (user.subscriptionStatus === 'active' && user.plan !== 'free') {
      return res.status(400).json({ 
        error: 'You already have an active subscription. Use customer portal to manage it.',
        portalUrl: true
      });
    }

    // Import createCheckout dynamically
    const { createCheckout } = await import('@lemonsqueezy/lemonsqueezy.js');

    // Create checkout session
    const checkout = await createCheckout(
      process.env.LEMONSQUEEZY_STORE_ID,
      variantId,
      {
        checkoutData: {
          email: user.email,
          custom: {
            user_id: userId.toString()
          }
        },
        productOptions: {
          enabledVariants: [parseInt(variantId)],
          redirectUrl: `${process.env.CLIENT_URL || 'https://devpost-a-ifrontend.vercel.app'}/dashboard?payment=success`
        },
        checkoutOptions: {
          embed: false,
          media: true,
          logo: true
        }
      }
    );

    if (checkout.error) {
      throw new Error(checkout.error.message);
    }

    res.json({
      success: true,
      checkoutUrl: checkout.data.data.attributes.url
    });

  } catch (error) {
    console.error('Create checkout error:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error.message 
    });
  }
};

// Create customer portal URL
export const createCustomerPortal = async (req, res) => {
  try {
    configureLemonSqueezy();
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has a subscription
    if (!user.lemonSqueezyCustomerId) {
      return res.status(400).json({ 
        error: 'No subscription found. Please subscribe first.' 
      });
    }

    // Import getCustomer dynamically
    const { getCustomer } = await import('@lemonsqueezy/lemonsqueezy.js');

    // Get customer portal URL
    const customer = await getCustomer(user.lemonSqueezyCustomerId);
    
    if (customer.error) {
      throw new Error(customer.error.message);
    }

    const portalUrl = customer.data.data.attributes.urls.customer_portal;

    res.json({
      success: true,
      portalUrl
    });

  } catch (error) {
    console.error('Customer portal error:', error);
    res.status(500).json({ 
      error: 'Failed to create customer portal URL',
      details: error.message 
    });
  }
};

// Get current subscription details
export const getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('plan subscriptionStatus subscriptionEndDate monthlyPostsCount');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate post limit based on plan
    const limits = {
      free: 5,
      starter: 15,
      pro: -1 // Unlimited
    };

    res.json({
      success: true,
      subscription: {
        plan: user.plan,
        status: user.subscriptionStatus || 'free',
        endDate: user.subscriptionEndDate,
        postsUsed: user.monthlyPostsCount,
        postsLimit: limits[user.plan] || 5,
        unlimited: user.plan === 'pro'
      }
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch subscription',
      details: error.message 
    });
  }
};

// Webhook handler
export const handleWebhook = async (req, res) => {
  try {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    
    if (!secret) {
      console.error('Webhook secret not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify webhook signature using raw body buffer
    const signature = req.headers['x-signature'];
    const rawBody = req.body; // Buffer from express.raw()

    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(rawBody).digest('hex');

    if (signature !== digest) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody.toString());
    const eventName = event.meta.event_name;

    console.log('Received webhook:', eventName);

    // Handle different event types
    switch (eventName) {
      case 'order_created':
        await handleOrderCreated(event);
        break;
      
      case 'subscription_created':
        await handleSubscriptionCreated(event);
        break;
      
      case 'subscription_updated':
        await handleSubscriptionUpdated(event);
        break;
      
      case 'subscription_cancelled':
      case 'subscription_expired':
        await handleSubscriptionCancelled(event);
        break;
      
      case 'subscription_resumed':
        await handleSubscriptionResumed(event);
        break;
      
      case 'subscription_paused':
        await handleSubscriptionPaused(event);
        break;

      default:
        console.log('Unhandled event type:', eventName);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Helper functions for webhook events

async function handleOrderCreated(event) {
  const customData = event.meta.custom_data;
  const userId = customData?.user_id;
  
  if (!userId) {
    console.error('No user_id in order');
    return;
  }

  const customerId = event.data.attributes.customer_id;
  
  await User.findByIdAndUpdate(userId, {
    lemonSqueezyCustomerId: customerId.toString()
  });

  console.log('Order created for user:', userId);
}

async function handleSubscriptionCreated(event) {
  const customData = event.meta.custom_data;
  const userId = customData?.user_id;
  
  if (!userId) {
    console.error('No user_id in subscription');
    return;
  }

  const subscription = event.data.attributes;
  const variantId = subscription.variant_id.toString();
  
  // Determine plan based on variant ID
  let plan = 'free';
  if (variantId === process.env.LEMONSQUEEZY_STARTER_VARIANT_ID) {
    plan = 'starter';
  } else if (variantId === process.env.LEMONSQUEEZY_PRO_VARIANT_ID) {
    plan = 'pro';
  }

  await User.findByIdAndUpdate(userId, {
    plan,
    lemonSqueezySubscriptionId: event.data.id,
    subscriptionStatus: subscription.status,
    subscriptionEndDate: subscription.renews_at ? new Date(subscription.renews_at) : null,
    subscriptionVariantId: variantId,
    lemonSqueezyCustomerId: subscription.customer_id.toString()
  });

  console.log(`Subscription created: User ${userId} → ${plan} plan`);
}

async function handleSubscriptionUpdated(event) {
  const subscriptionId = event.data.id;
  const subscription = event.data.attributes;
  
  const user = await User.findOne({ lemonSqueezySubscriptionId: subscriptionId });
  
  if (!user) {
    console.error('User not found for subscription:', subscriptionId);
    return;
  }

  const variantId = subscription.variant_id.toString();
  
  // Determine plan based on variant ID
  let plan = user.plan; // Keep current plan if variant not recognized
  if (variantId === process.env.LEMONSQUEEZY_STARTER_VARIANT_ID) {
    plan = 'starter';
  } else if (variantId === process.env.LEMONSQUEEZY_PRO_VARIANT_ID) {
    plan = 'pro';
  }

  await User.findByIdAndUpdate(user._id, {
    plan,
    subscriptionStatus: subscription.status,
    subscriptionEndDate: subscription.renews_at ? new Date(subscription.renews_at) : null,
    subscriptionVariantId: variantId
  });

  console.log(`Subscription updated: User ${user._id} → ${plan} plan (${subscription.status})`);
}

async function handleSubscriptionCancelled(event) {
  const subscriptionId = event.data.id;
  const subscription = event.data.attributes;
  
  const user = await User.findOne({ lemonSqueezySubscriptionId: subscriptionId });
  
  if (!user) {
    console.error('User not found for subscription:', subscriptionId);
    return;
  }

  // Downgrade to free plan
  await User.findByIdAndUpdate(user._id, {
    plan: 'free',
    subscriptionStatus: subscription.status, // 'cancelled' or 'expired'
    subscriptionEndDate: subscription.ends_at ? new Date(subscription.ends_at) : null
  });

  console.log(`Subscription cancelled: User ${user._id} → free plan`);
}

async function handleSubscriptionResumed(event) {
  const subscriptionId = event.data.id;
  const subscription = event.data.attributes;
  
  const user = await User.findOne({ lemonSqueezySubscriptionId: subscriptionId });
  
  if (!user) {
    console.error('User not found for subscription:', subscriptionId);
    return;
  }

  const variantId = subscription.variant_id.toString();
  
  // Determine plan based on variant ID
  let plan = 'starter';
  if (variantId === process.env.LEMONSQUEEZY_PRO_VARIANT_ID) {
    plan = 'pro';
  }

  await User.findByIdAndUpdate(user._id, {
    plan,
    subscriptionStatus: 'active',
    subscriptionEndDate: subscription.renews_at ? new Date(subscription.renews_at) : null
  });

  console.log(`Subscription resumed: User ${user._id} → ${plan} plan`);
}

async function handleSubscriptionPaused(event) {
  const subscriptionId = event.data.id;
  const subscription = event.data.attributes;
  
  const user = await User.findOne({ lemonSqueezySubscriptionId: subscriptionId });
  
  if (!user) {
    console.error('User not found for subscription:', subscriptionId);
    return;
  }

  await User.findByIdAndUpdate(user._id, {
    subscriptionStatus: 'paused',
    subscriptionEndDate: subscription.resumes_at ? new Date(subscription.resumes_at) : null
  });

  console.log(`Subscription paused: User ${user._id}`);
}
