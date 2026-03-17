import { lemonSqueezySetup, listStores, getAuthenticatedUser } from '@lemonsqueezy/lemonsqueezy.js';
import dotenv from 'dotenv';

dotenv.config();

const checkStores = async () => {
  try {
    console.log('🔍 Checking Lemon Squeezy configuration...\n');
    
    lemonSqueezySetup({
      apiKey: process.env.LEMONSQUEEZY_API_KEY,
      onError: (error) => console.error('API Error:', error),
    });

    // Check user first
    const user = await getAuthenticatedUser();
    console.log('👤 User:', user.data.data.attributes.name);
    console.log('   Test Mode:', user.data.data.attributes.test_mode ? '✅ YES' : '❌ NO');
    console.log('');

    // List all stores
    const stores = await listStores();
    
    if (stores.error) {
      console.error('❌ Failed to fetch stores:', stores.error);
      return;
    }

    console.log(`🏪 Found ${stores.data.data.length} store(s):\n`);

    for (const store of stores.data.data) {
      console.log('Store:', store.attributes.name);
      console.log('   Store ID:', store.id);
      console.log('   Domain:', store.attributes.domain);
      console.log('   Configured Store ID:', process.env.LEMONSQUEEZY_STORE_ID);
      console.log('   Match:', store.id === process.env.LEMONSQUEEZY_STORE_ID ? '✅' : '❌');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

checkStores();
