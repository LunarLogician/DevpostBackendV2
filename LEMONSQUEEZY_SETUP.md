# Lemon Squeezy Integration Setup Guide

## Overview
DevPost AI uses Lemon Squeezy for subscription payments. This guide will help you set up Lemon Squeezy after your store gets approved.

## Pricing Plans
1. **Free Plan**: $0/month - 5 posts/month
2. **Starter Plan**: $5/month - 15 posts/month
3. **Pro Plan**: $20/month - Unlimited posts

## Prerequisites
- Lemon Squeezy account created and store approved
- Access to Lemon Squeezy dashboard

## Setup Steps

### 1. Get API Key
1. Go to [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com)
2. Navigate to Settings → API
3. Click "Create API Key"
4. Copy the API key and add it to your `.env` file:
   ```env
   LEMONSQUEEZY_API_KEY=your_api_key_here
   ```

### 2. Get Store ID
1. In Lemon Squeezy dashboard, go to Settings → Stores
2. Copy your Store ID (numeric value)
3. Add it to `.env`:
   ```env
   LEMONSQUEEZY_STORE_ID=12345
   ```

### 3. Create Products and Variants

#### Create Starter Plan Product:
1. Go to Products → New Product
2. Name: "DevPost AI - Starter Plan"
3. Price: $5.00 USD
4. Billing: Recurring Monthly
5. Description: "Generate up to 15 LinkedIn posts per month with AI"
6. After creation, copy the **Variant ID** from the product details
7. Add to `.env`:
   ```env
   LEMONSQUEEZY_STARTER_VARIANT_ID=123456
   ```

#### Create Pro Plan Product:
1. Go to Products → New Product
2. Name: "DevPost AI - Pro Plan"
3. Price: $20.00 USD
4. Billing: Recurring Monthly
5. Description: "Unlimited LinkedIn posts per month with AI"
6. After creation, copy the **Variant ID** from the product details
7. Add to `.env`:
   ```env
   LEMONSQUEEZY_PRO_VARIANT_ID=123457
   ```

### 4. Setup Webhook
1. In Lemon Squeezy dashboard, go to Settings → Webhooks
2. Click "Create Webhook"
3. Set the URL to: `https://your-domain.com/api/lemonsqueezy/webhook`
   - Replace `your-domain.com` with your actual Railway domain
   - Example: `https://server-production-abc123.up.railway.app/api/lemonsqueezy/webhook`
4. Select the following events:
   - `order_created`
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_expired`
   - `subscription_resumed`
   - `subscription_paused`
5. Copy the **Signing Secret**
6. Add to `.env`:
   ```env
   LEMONSQUEEZY_WEBHOOK_SECRET=your_signing_secret_here
   ```

### 5. Configure Railway Environment Variables
After setting up everything locally, add the same variables to your Railway app:

1. Go to your Railway project
2. Click on your service
3. Go to "Variables" tab
4. Add each environment variable:
   - `LEMONSQUEEZY_API_KEY`
   - `LEMONSQUEEZY_STORE_ID`
   - `LEMONSQUEEZY_STARTER_VARIANT_ID`
   - `LEMONSQUEEZY_PRO_VARIANT_ID`
   - `LEMONSQUEEZY_WEBHOOK_SECRET`

### 6. Test the Integration

#### Test Checkout Flow:
1. Make a POST request to `/api/lemonsqueezy/create-checkout`
   ```bash
   curl -X POST https://your-domain.com/api/lemonsqueezy/create-checkout \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"plan": "starter"}'
   ```
2. You should receive a `checkoutUrl` in the response
3. Open the URL in a browser and complete a test purchase

#### Test Webhook:
1. In Lemon Squeezy dashboard, go to Webhooks
2. Click on your webhook
3. Use the "Test Webhook" feature
4. Check your Railway logs to verify webhook was received

## API Endpoints

### 1. Create Checkout Session
**POST** `/api/lemonsqueezy/create-checkout`
- **Auth**: Required (JWT token)
- **Body**:
  ```json
  {
    "plan": "starter" // or "pro"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "checkoutUrl": "https://checkout.lemonsqueezy.com/..."
  }
  ```

### 2. Get Customer Portal
**POST** `/api/lemonsqueezy/customer-portal`
- **Auth**: Required (JWT token)
- **Response**:
  ```json
  {
    "success": true,
    "portalUrl": "https://portal.lemonsqueezy.com/..."
  }
  ```

### 3. Get Current Subscription
**GET** `/api/lemonsqueezy/subscription`
- **Auth**: Required (JWT token)
- **Response**:
  ```json
  {
    "success": true,
    "subscription": {
      "plan": "starter",
      "status": "active",
      "endDate": "2024-02-15T00:00:00.000Z",
      "postsUsed": 3,
      "postsLimit": 15,
      "unlimited": false
    }
  }
  ```

### 4. Webhook Handler
**POST** `/api/lemonsqueezy/webhook`
- **Auth**: None (verified via signature)
- This endpoint is called automatically by Lemon Squeezy

## Frontend Integration

### Starter Plan Checkout Button
```javascript
const handleUpgrade = async (plan) => {
  try {
    const response = await fetch('https://your-api.com/api/lemonsqueezy/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({ plan }) // 'starter' or 'pro'
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Redirect user to checkout
      window.location.href = data.checkoutUrl;
    }
  } catch (error) {
    console.error('Checkout error:', error);
  }
};
```

### Customer Portal Button
```javascript
const handleManageSubscription = async () => {
  try {
    const response = await fetch('https://your-api.com/api/lemonsqueezy/customer-portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Open portal in new tab
      window.open(data.portalUrl, '_blank');
    }
  } catch (error) {
    console.error('Portal error:', error);
  }
};
```

### Display Subscription Info
```javascript
const [subscription, setSubscription] = useState(null);

useEffect(() => {
  const fetchSubscription = async () => {
    try {
      const response = await fetch('https://your-api.com/api/lemonsqueezy/subscription', {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error('Fetch subscription error:', error);
    }
  };
  
  fetchSubscription();
}, []);

// Display in UI
{subscription && (
  <div>
    <h3>Your Plan: {subscription.plan.toUpperCase()}</h3>
    <p>Status: {subscription.status}</p>
    {!subscription.unlimited && (
      <p>Posts Used: {subscription.postsUsed} / {subscription.postsLimit}</p>
    )}
    {subscription.unlimited && <p>Unlimited Posts</p>}
  </div>
)}
```

## How It Works

### User Subscription Flow:
1. User clicks "Upgrade to Starter" or "Upgrade to Pro"
2. Frontend calls `/api/lemonsqueezy/create-checkout` with plan name
3. Backend creates checkout session and returns URL
4. User is redirected to Lemon Squeezy checkout
5. User completes payment
6. Lemon Squeezy sends webhook to `/api/lemonsqueezy/webhook`
7. Backend updates user's plan in database
8. User is redirected back to your app with updated plan

### Monthly Post Count Reset:
- The `canGeneratePost()` method in User model automatically resets monthly count
- It checks if the current month is different from `lastResetDate`
- If yes, it resets `monthlyPostsCount` to 0 and updates `lastResetDate`

### Subscription Management:
- Users can manage their subscription via Customer Portal
- Portal allows: upgrade, downgrade, cancel, update payment method
- All changes are automatically synced via webhooks

## Testing

### Test Mode
Lemon Squeezy provides test mode for development:
1. In dashboard, toggle "Test Mode" ON
2. Use test card: `4242 4242 4242 4242`
3. Any future date for expiry
4. Any CVC

### Production Mode
When ready for production:
1. Toggle "Test Mode" OFF
2. Update webhook URL to production domain
3. Real payments will be processed

## Troubleshooting

### Webhook Not Working
- Verify webhook URL is correct and accessible
- Check Railway logs for webhook errors
- Ensure webhook secret is correct
- Verify webhook events are selected in dashboard

### Checkout Not Creating
- Check API key is correct
- Verify store ID and variant IDs
- Check Railway logs for detailed error messages
- Ensure user is authenticated

### Plan Not Updating
- Check webhook is receiving events
- Verify webhook signature validation
- Check database for user subscription fields
- Look for errors in Railway logs

## Support
- Lemon Squeezy Docs: https://docs.lemonsqueezy.com
- Lemon Squeezy Support: support@lemonsqueezy.com
