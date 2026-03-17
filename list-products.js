import { lemonSqueezySetup, listProducts, getProduct } from '@lemonsqueezy/lemonsqueezy.js';
import dotenv from 'dotenv';

dotenv.config();

const listAllProducts = async () => {
  try {
    console.log('🔍 Fetching all products from Lemon Squeezy...\n');
    
    lemonSqueezySetup({
      apiKey: process.env.LEMONSQUEEZY_API_KEY,
      onError: (error) => console.error('API Error:', error),
    });

    const products = await listProducts({
      filter: { storeId: process.env.LEMONSQUEEZY_STORE_ID }
    });

    if (products.error) {
      console.error('❌ Failed to fetch products:', products.error);
      return;
    }

    console.log(`✅ Found ${products.data.data.length} product(s):\n`);

    for (const product of products.data.data) {
      const productData = product.attributes;
      console.log('📦 Product:', productData.name);
      console.log('   Product ID:', product.id);
      console.log('   Status:', productData.status);
      console.log('   Price:', productData.price_formatted);
      
      // Get full product details with variants
      const fullProduct = await getProduct(product.id, {
        include: ['variants']
      });
      
      if (fullProduct.data.included) {
        console.log('   Variants:');
        for (const variant of fullProduct.data.included) {
          if (variant.type === 'variants') {
            console.log(`      - Variant ID: ${variant.id}`);
            console.log(`        Name: ${variant.attributes.name}`);
            console.log(`        Price: ${variant.attributes.price}`);
          }
        }
      }
      console.log('');
    }

    console.log('💡 Use the Variant IDs above in your .env file!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

listAllProducts();
