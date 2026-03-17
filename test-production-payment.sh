#!/bin/bash

echo "🧪 Testing Production Payment Integration..."
echo ""

# Test checkout creation
echo "📝 Creating checkout session for Starter plan..."
RESPONSE=$(curl -s -X POST https://devpostaibackend-production.up.railway.app/api/lemonsqueezy/create-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{"plan": "starter"}')

echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q "checkoutUrl"; then
  echo "✅ Payment integration is working!"
  echo ""
  CHECKOUT_URL=$(echo "$RESPONSE" | grep -o '"checkoutUrl":"[^"]*' | cut -d'"' -f4)
  echo "🔗 Checkout URL: $CHECKOUT_URL"
  echo ""
  echo "💡 Next steps:"
  echo "1. Open the URL above to test payment"
  echo "2. Complete checkout"
  echo "3. Webhook will automatically update user's plan in database"
else
  echo "❌ Error occurred. Check Railway logs for details."
fi
