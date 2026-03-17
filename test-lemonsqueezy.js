import { lemonSqueezySetup, getAuthenticatedUser } from '@lemonsqueezy/lemonsqueezy.js';
import dotenv from 'dotenv';

dotenv.config();

// Test Lemon Squeezy API connection
const testConnection = async () => {
  try {
    console.log('🔍 Testing Lemon Squeezy API...\n');
    
    // Setup API
    lemonSqueezySetup({
      apiKey: process.env.LEMONSQUEEZY_API_KEY,
      onError: (error) => {
        console.error('❌ API Error:', error);
      },
    });

    // Get authenticated user info
    const user = await getAuthenticatedUser();
    
    if (user.error) {
      console.error('❌ Connection Failed:', user.error.message);
      return;
    }

    console.log('✅ Connection Successful!\n');
    console.log('📊 Account Info:');
    console.log('   User ID:', user.data.data.id);
    console.log('   Name:', user.data.data.attributes.name);
    console.log('   Email:', user.data.data.attributes.email);
    console.log('   Test Mode:', user.data.data.attributes.test_mode ? '✅ YES (Test Mode Active)' : '❌ NO (Production Mode)');
    
    console.log('\n📝 Next Steps:');
    console.log('1. Get your Store ID from Lemon Squeezy dashboard');
    console.log('2. Create two products (Starter $5 & Pro $20)');
    console.log('3. Get the Variant IDs for each product');
    console.log('4. Setup webhook and get the signing secret');
    console.log('\n💡 Tip: You can use test card 4242 4242 4242 4242 in test mode!');

  } catch (error) {
    console.error('❌ Unexpected Error:', error.message);
  }
};

testConnection();
