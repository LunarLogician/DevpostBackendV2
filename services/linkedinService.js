import User from '../models/User.js';
import { refreshLinkedInToken } from '../controllers/linkedinController.js';
import axios from 'axios';

// @desc    Post content to LinkedIn
// @param   userId - User ID
// @param   content - Post content/text
// @returns LinkedIn post URL or error
export const postToLinkedIn = async (userId, content) => {
  try {
    console.log('\n🔵 ===== LINKEDIN POST DETAILED LOG START =====');
    console.log(`📝 Step 1: Fetching user ${userId}`);
    
    const user = await User.findById(userId);
    console.log(`   ✓ User found: ${user.name}`);

    if (!user.linkedinAccessToken) {
      console.log('   ❌ ERROR: No LinkedIn access token');
      throw new Error('LinkedIn not connected');
    }

    const tokenStart = user.linkedinAccessToken.substring(0, 30);
    const tokenLen = user.linkedinAccessToken.length;
    console.log(`   ✓ Token retrieved from DB: ${tokenStart}... (length: ${tokenLen})`);
    console.log(`   ✓ LinkedIn User ID: ${user.linkedinUserId}`);
    console.log(`   ✓ Token expiry: ${user.linkedinTokenExpiry}`);

    // Check if LinkedIn User ID is missing but token exists
    if (!user.linkedinUserId) {
      console.log('   ⚠️  LinkedIn User ID is missing! Attempting to fetch from userinfo endpoint...');
      let fetchedId = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`      Attempt ${attempt}/3: Calling userinfo endpoint...`);
          const meResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
            headers: {
              'Authorization': `Bearer ${user.linkedinAccessToken}`
            },
            timeout: 10000
          });
          
          fetchedId = meResponse.data.sub;
          console.log(`      ✓ Retrieved LinkedIn User ID: ${fetchedId}`);
          break;
        } catch (meError) {
          const errorDetails = meError.response ? 
            `${meError.response.status} ${JSON.stringify(meError.response.data)}` : 
            meError.message;
          console.log(`      ❌ Attempt ${attempt} failed: ${errorDetails}`);
          if (attempt < 3) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      
      if (fetchedId) {
        user.linkedinUserId = fetchedId;
        await user.save();
        console.log(`   ✓ Saved LinkedIn user ID to database`);
      } else {
        console.log(`   ❌ Failed to fetch user ID after 3 attempts`);
        throw new Error('Could not retrieve your LinkedIn user ID. Please reconnect your account.');
      }
    }

    // Validate token is actually working by calling userinfo
    console.log(`\n📝 Step 1b: Validating token is active`);
    try {
      const validationResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${user.linkedinAccessToken}`
        },
        timeout: 10000
      });
      console.log(`   ✓ Token is valid and active`);
      console.log(`   ✓ LinkedIn Sub: ${validationResponse.data.sub}`);
    } catch (validationError) {
      const errorDetails = validationError.response ? 
        `${validationError.response.status} ${JSON.stringify(validationError.response.data)}` : 
        validationError.message;
      console.log(`   ❌ Token validation failed: ${errorDetails}`);
      throw new Error(`LinkedIn token is not valid: ${errorDetails}`);
    }

    // Create LinkedIn post using UGC API
    console.log(`\n📝 Step 2: Preparing post data`);
    const postData = {
      author: `urn:li:person:${user.linkedinUserId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    console.log(`   ✓ Post data prepared`);
    console.log(`   ✓ Content length: ${content.length} chars`);
    console.log(`   ✓ Author URN: ${postData.author}`);

    // Add timeout for slow networks
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      console.log(`\n📝 Step 3: Sending POST to LinkedIn API`);
      console.log(`   🌐 URL: https://api.linkedin.com/v2/ugcPosts`);
      console.log(`   📤 Timeout: 30000ms`);
      console.log(`   🔑 Token Info:`);
      console.log(`      - Token starts with: ${user.linkedinAccessToken.substring(0, 30)}`);
      console.log(`      - Token length: ${user.linkedinAccessToken.length}`);
      console.log(`      - Token valid until: ${user.linkedinTokenExpiry}`);
      console.log(`      - Current time: ${new Date().toISOString()}`);
      
      const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
        headers: {
          'Authorization': `Bearer ${user.linkedinAccessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        timeout: 30000,
        signal: controller.signal
      });

      clearTimeout(timeout);

      console.log(`\n✅ Step 4: Success response received`);
      console.log(`   ✓ Status: ${response.status}`);
      console.log(`   ✓ Response: ${JSON.stringify(response.data)}`);

      // Extract post ID and construct URL
      const postId = response.data.id;
      const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

      console.log(`   ✓ Post ID: ${postId}`);
      console.log(`   ✓ Post URL: ${postUrl}`);
      console.log(`\n🟢 ===== LINKEDIN POST SUCCESS =====\n`);

      return {
        success: true,
        postUrl,
        postId
      };
    } catch (fetchError) {
      clearTimeout(timeout);
      
      console.log(`\n❌ Step 4: Error during request`);
      console.log(`   Error name: ${fetchError.name}`);
      console.log(`   Error code: ${fetchError.code}`);
      console.log(`   Error message: ${fetchError.message}`);
      
      if (fetchError.response) {
        console.log(`   ✓ Response received from LinkedIn`);
        console.log(`   Status: ${fetchError.response.status}`);
        console.log(`   Data: ${JSON.stringify(fetchError.response.data)}`);
      } else {
        console.log(`   ❌ No response received from LinkedIn`);
      }
      
      if (fetchError.config) {
        console.log(`   Request headers: ${JSON.stringify(fetchError.config.headers)}`);
        console.log(`   Request data: ${fetchError.config.data ? fetchError.config.data.substring(0, 100) : 'N/A'}`);
      }
      
      if (fetchError.name === 'AbortError' || fetchError.code === 'ECONNABORTED') {
        console.log('   ⚠️  Request aborted/timeout');
        throw new Error('LinkedIn API timeout (30s exceeded). Your network connection may be slow.');
      }
      
      if (fetchError.code === 'ETIMEDOUT') {
        console.log('   ⚠️  Network timeout');
        throw new Error('Network timeout connecting to LinkedIn. Please check your internet and try again.');
      }
      
      if (fetchError.response) {
        console.log('   ⚠️  API returned error');
        throw new Error(fetchError.response.data.message || 'Failed to post to LinkedIn');
      }
      
      console.log(`\n🔴 ===== LINKEDIN POST FAILED =====\n`);
      throw fetchError;
    }

  } catch (error) {
    console.error('❌ Final error in postToLinkedIn:', error.message);
    throw error;
  }
};

// @desc    Check if user's LinkedIn token is valid
export const isLinkedInTokenValid = async (userId) => {
  try {
    const user = await User.findById(userId);
    
    if (!user.linkedinAccessToken) {
      return false;
    }

    if (user.linkedinTokenExpiry && new Date() >= user.linkedinTokenExpiry) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

// @desc    Fetch LinkedIn posts for the user
// @param   userId - User ID
// @param   count - Number of posts to fetch (default: 10, max: 50)
// @returns Array of LinkedIn posts
export const fetchLinkedInPosts = async (userId, count = 10) => {
  try {
    const user = await User.findById(userId);

    if (!user.linkedinAccessToken) {
      throw new Error('LinkedIn not connected');
    }

    if (!user.linkedinUserId) {
      throw new Error('LinkedIn user ID not found. Please reconnect your LinkedIn account.');
    }

    // Check if token is expired and refresh if needed
    if (user.linkedinTokenExpiry && new Date() >= user.linkedinTokenExpiry) {
      console.log('Token expired, refreshing...');
      try {
        await refreshLinkedInToken(userId);
        // Reload user with fresh token
        const updatedUser = await User.findById(userId);
        user.linkedinAccessToken = updatedUser.linkedinAccessToken;
        user.linkedinTokenExpiry = updatedUser.linkedinTokenExpiry;
      } catch (error) {
        throw new Error('LinkedIn token expired. Please reconnect your account.');
      }
    }

    // Validate count
    const postCount = Math.min(Math.max(count, 1), 50);

    // Debug logs
    console.log('📥 Fetching LinkedIn posts...');
    console.log('   User ID:', user.linkedinUserId);
    console.log('   Token present:', !!user.linkedinAccessToken);
    console.log('   Token expiry:', user.linkedinTokenExpiry);

    // Create AbortController for timeout (30 seconds for slow networks)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let responseData;
    try {
      // Fetch posts using LinkedIn UGC Posts API
      // Format: q=authors&authors=List(urn:li:person:ID)
      const apiUrl = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List%28urn%3Ali%3Aperson%3A${user.linkedinUserId}%29&count=${postCount}`;
      console.log('   API URL:', apiUrl);

      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${user.linkedinAccessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        },
        timeout: 30000,
        signal: controller.signal
      });

      clearTimeout(timeout);

      console.log('   Response status:', response.status);
      responseData = response.data;

      console.log('✅ Successfully fetched', responseData.elements?.length || 0, 'posts');
    } catch (fetchError) {
      clearTimeout(timeout);
      
      if (fetchError.name === 'AbortError' || fetchError.code === 'ECONNABORTED') {
        throw new Error('LinkedIn API timeout (30s exceeded). Your network connection may be slow. Please try again.');
      }
      
      // Better error messages for network issues
      if (fetchError.code === 'ETIMEDOUT') {
        throw new Error('Network timeout connecting to LinkedIn. Please check your internet connection and try again.');
      }
      
      if (fetchError.code === 'ECONNREFUSED') {
        throw new Error('Connection refused by LinkedIn API. Please try again later.');
      }
      
      if (fetchError.response) {
        console.error('LinkedIn fetch posts error:', fetchError.response.data);
        throw new Error(fetchError.response.data.message || `Failed to fetch LinkedIn posts (Status: ${fetchError.response.status})`);
      }
      
      throw fetchError;
    }

    // Parse and format the posts
    const posts = responseData.elements?.map(post => {
      const text = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
      const createdAt = post.created?.time ? new Date(post.created.time) : null;
      const lastModified = post.lastModified?.time ? new Date(post.lastModified.time) : null;
      
      return {
        id: post.id,
        text: text,
        createdAt: createdAt,
        lastModified: lastModified,
        lifecycleState: post.lifecycleState,
        visibility: post.visibility?.['com.linkedin.ugc.MemberNetworkVisibility'],
        url: `https://www.linkedin.com/feed/update/${post.id}`
      };
    }) || [];

    return {
      success: true,
      count: posts.length,
      posts: posts
    };

  } catch (error) {
    console.error('Error fetching LinkedIn posts:', error);
    throw error;
  }
};
