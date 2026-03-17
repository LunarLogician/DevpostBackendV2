import { lemonSqueezySetup, createCheckout } from '@lemonsqueezy/lemonsqueezy.js';
import dotenv from 'dotenv';

dotenv.config();

const testCheckout = async () => {
  try {
    console.log('🧪 Testing Lemon Squeezy Checkout Creation...\n');
    
    lemonSqueezySetup({
      apiKey: process.env.LEMONSQUEEZY_API_KEY,
      onError: (error) => console.error('API Error:', error),
    });

    console.log('📋 Configuration:');
    console.log('   Store ID:', process.env.LEMONSQUEEZY_STORE_ID);
    console.log('   Starter Variant ID:', process.env.LEMONSQUEEZY_STARTER_VARIANT_ID);
    console.log('   Pro Variant ID:', process.env.LEMONSQUEEZY_PRO_VARIANT_ID);
    console.log('   Webhook Secret:', process.env.LEMONSQUEEZY_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing');
    console.log('\n🚀 Creating test checkout for Starter plan...\n');

    const checkout = await createCheckout(
      process.env.LEMONSQUEEZY_STORE_ID,
      process.env.LEMONSQUEEZY_STARTER_VARIANT_ID,
      {
        checkoutData: {
          email: 'test@example.com',
          custom: {
            user_id: 'test_user_123'
          }
        },
        checkoutOptions: {
          embed: false
        }
      }
    );

    if (checkout.error) {
      console.error('❌ Checkout creation failed:', checkout.error);
      return;
    }

    console.log('✅ Checkout created successfully!\n');
    console.log('🔗 Checkout URL:', checkout.data.data.attributes.url);
    console.log('\n💡 Copy this URL and open it in your browser to test payment!');
    console.log('\n📝 Test Card Details (Test Mode):');
    console.log('   Card Number: 4242 4242 4242 4242');
    console.log('   Expiry: Any future date (e.g., 12/30)');
    console.log('   CVC: Any 3 digits (e.g., 123)');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

testCheckout();
