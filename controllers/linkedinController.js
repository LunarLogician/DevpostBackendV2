import User from '../models/User.js';
import { fetchLinkedInPosts } from '../services/linkedinService.js';
import axios from 'axios';

// Helper function to fetch LinkedIn user ID if missing
async function fetchAndSaveLinkedInUserId(user, accessToken) {
  try {
    console.log(`\n🔄 Attempting to fetch LinkedIn user ID for user ${user._id}`);
    const response = await axios.get('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      timeout: 30000
    });
    
    const userId = response.data.id;
    console.log(`   ✓ Got LinkedIn user ID: ${userId}`);
    
    user.linkedinUserId = userId;
    await user.save();
    
    console.log(`   ✓ Saved LinkedIn user ID to database`);
    return userId;
  } catch (error) {
    console.error(`   ❌ Failed to fetch LinkedIn user ID:`, error.message);
    return null;
  }
}

// @desc    Initiate LinkedIn OAuth
// @route   GET /api/linkedin/auth
// @access  Private
export const initiateLinkedInAuth = (req, res) => {
  const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
  const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:5000/api/linkedin/callback';
  
  if (!LINKEDIN_CLIENT_ID) {
    return res.status(500).json({
      success: false,
      message: 'LinkedIn client ID not configured'
    });
  }
  
  const state = req.user._id.toString(); // Use user ID as state for verification
  
  // ALL required scopes for posting to LinkedIn
  const scopes = ['openid', 'profile', 'email', 'w_member_social'];
  const scopeString = scopes.join('%20'); // URL-encoded space separator
  
  console.log(`\n📝 Initiating LinkedIn OAuth`);
  console.log(`   Scopes requested: ${scopes.join(', ')}`);
  
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
    `response_type=code` +
    `&client_id=${LINKEDIN_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}` +
    `&state=${state}` +
    `&scope=${scopeString}` +
    `&prompt=consent`; // Force consent screen to always show

  console.log(`   Authorization URL: ${authUrl.substring(0, 100)}...`);

  res.json({
    success: true,
    authUrl
  });
};

// @desc    Handle LinkedIn OAuth callback
// @route   GET /api/linkedin/callback
// @access  Public
export const handleLinkedInCallback = async (req, res) => {
  try {
    console.log('\n\n🟦 ===== LINKEDIN OAUTH CALLBACK START =====');
    const { code, state } = req.query;
    console.log(`📝 Step 1: Received callback`);
    console.log(`   ✓ Code: ${code ? code.substring(0, 20) + '...' : 'MISSING'}`);
    console.log(`   ✓ State (User ID): ${state}`);
    
    const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
    const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
    const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:5000/api/linkedin/callback';
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

    console.log(`   ✓ CLIENT_ID: ${LINKEDIN_CLIENT_ID}`);
    console.log(`   ✓ REDIRECT_URI: ${LINKEDIN_REDIRECT_URI}`);

    if (!code) {
      console.log(`   ❌ No code provided`);
      return res.redirect(`${CLIENT_URL}/dashboard?error=no_code`);
    }

    // Exchange code for access token
    console.log(`\n📝 Step 2: Exchanging code for access token`);
    console.log(`   🌐 POST https://www.linkedin.com/oauth/v2/accessToken`);
    
    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
        redirect_uri: LINKEDIN_REDIRECT_URI
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    );

    const tokenData = tokenResponse.data;
    
    console.log(`   ✓ Token exchange successful`);
    console.log(`   ✓ Access Token: ${tokenData.access_token ? tokenData.access_token.substring(0, 30) + '...' : 'MISSING'}`);
    console.log(`   ✓ Token Type: ${tokenData.token_type}`);
    console.log(`   ✓ Expires In: ${tokenData.expires_in} seconds`);
    console.log(`   ✓ Scope: ${tokenData.scope && Object.keys(tokenData.scope).length > 0 ? JSON.stringify(tokenData.scope) : '(no scope info in response)'}`);
    console.log(`   ✓ Refresh Token: ${tokenData.refresh_token ? 'YES' : 'NO'}`);

    // Check if scopes include w_member_social
    const scopeStr = tokenData.scope ? JSON.stringify(tokenData.scope) : '';
    if (!scopeStr.includes('w_member_social')) {
      console.warn(`   ⚠️  WARNING: w_member_social may not be in response!`);
      console.warn(`   If posting fails with 401, the LinkedIn app may need approval for sharing functionality`);
    }

    // Update user with LinkedIn tokens
    console.log(`\n📝 Step 3: Finding user ${state}`);
    const user = await User.findById(state);
    
    if (!user) {
      console.log(`   ❌ User not found`);
      return res.redirect(`${CLIENT_URL}/dashboard?error=user_not_found`);
    }
    
    console.log(`   ✓ User found: ${user.name}`);

    // Try to get LinkedIn user profile for additional security check
    console.log(`\n📝 Step 4: Fetching LinkedIn user ID with retry logic`);
    let profileData = null;
    let profileError = null;
    
    // Try userinfo endpoint with retries (more reliable than /me)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/3: Calling userinfo endpoint...`);
        const profileResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`
          },
          timeout: 10000  // Shorter timeout for retries
        });
        profileData = profileResponse.data;
        console.log(`   ✓ userinfo endpoint successful on attempt ${attempt}`);
        console.log(`   ✓ User ID (sub): ${profileData.sub}`);
        break; // Success, exit retry loop
      } catch (error) {
        profileError = error;
        const errorDetails = error.response ? 
          `${error.response.status} ${JSON.stringify(error.response.data)}` : 
          error.message;
        console.log(`   ❌ Attempt ${attempt} failed: ${errorDetails}`);
        if (attempt < 3) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    if (!profileData && profileError) {
      const finalErrorDetails = profileError.response ? 
        `${profileError.response.status} ${JSON.stringify(profileError.response.data)}` : 
        profileError.message;
      console.warn(`⚠️  Could not fetch LinkedIn profile after 3 attempts, proceeding without linkedinUserId`);
      console.warn(`   Final error: ${finalErrorDetails}`);
    }

    // If we have profile data, check for reuse
    if (profileData) {
      console.log(`   ✓ Profile data received`);
      console.log(`   ✓ LinkedIn User ID: ${profileData.sub}`);
      
      // SECURITY: Prevent LinkedIn account reuse across multiple DevPost accounts
      const existingLinkedInUser = await User.findOne({
        linkedinUserId: profileData.sub,
        _id: { $ne: user._id }
      });

      if (existingLinkedInUser) {
        const hasActiveToken = existingLinkedInUser.linkedinAccessToken &&
          existingLinkedInUser.linkedinTokenExpiry &&
          new Date(existingLinkedInUser.linkedinTokenExpiry) > new Date();

        if (hasActiveToken) {
          console.log(`🚫 LinkedIn reuse blocked: User ${user._id} tried to connect LinkedIn already used by user ${existingLinkedInUser._id}`);
          return res.redirect(`${CLIENT_URL}/dashboard?error=linkedin_already_used`);
        } else {
          console.log(`🔄 LinkedIn claim: clearing stale LinkedIn from user ${existingLinkedInUser._id} so user ${user._id} can connect`);
          existingLinkedInUser.linkedinAccessToken = null;
          existingLinkedInUser.linkedinRefreshToken = null;
          existingLinkedInUser.linkedinTokenExpiry = null;
          existingLinkedInUser.linkedinUserId = null;
          existingLinkedInUser.autoPostToLinkedIn = false;
          await existingLinkedInUser.save();
        }
      }

      user.linkedinUserId = profileData.sub;
    } else {
      console.log(`   ⚠️  No profile data - LinkedIn User ID will be fetched on first post attempt`);
    }

    // Always save the access token, even if profile fetch failed
    console.log(`\n📝 Step 5: Saving tokens to database`);
    console.log(`   Token to save (first 50 chars): ${tokenData.access_token.substring(0, 50)}`);
    console.log(`   Token length: ${tokenData.access_token.length}`);
    console.log(`   Token type: ${typeof tokenData.access_token}`);
    
    user.linkedinAccessToken = tokenData.access_token;
    user.linkedinRefreshToken = tokenData.refresh_token || null;
    user.linkedinTokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000);
    
    console.log(`   ✓ Token assigned to user object`);
    console.log(`   ✓ User.linkedinAccessToken length: ${user.linkedinAccessToken.length}`);
    console.log(`   ✓ Token expiry: ${user.linkedinTokenExpiry}`);
    
    await user.save();

    console.log(`\n📝 Step 6: Verifying saved token`);
    const savedUser = await User.findById(user._id);
    console.log(`   ✓ Retrieving user from DB...`);
    console.log(`   ✓ Saved token (first 50 chars): ${savedUser.linkedinAccessToken ? savedUser.linkedinAccessToken.substring(0, 50) : 'NULL'}`);
    console.log(`   ✓ Saved token length: ${savedUser.linkedinAccessToken ? savedUser.linkedinAccessToken.length : 0}`);

    console.log(`\n🟢 ===== LINKEDIN OAUTH CALLBACK SUCCESS =====\n`);
    res.redirect(`${CLIENT_URL}/dashboard?linkedin=connected`);

  } catch (error) {
    console.error('LinkedIn callback error:', error);
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${CLIENT_URL}/dashboard?error=auth_failed`);
  }
};

// @desc    Disconnect LinkedIn
// @route   POST /api/linkedin/disconnect
// @access  Private
export const disconnectLinkedIn = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    user.linkedinAccessToken = null;
    user.linkedinRefreshToken = null;
    user.linkedinTokenExpiry = null;
    user.linkedinUserId = null;
    user.autoPostToLinkedIn = false;
    await user.save();

    res.json({
      success: true,
      message: 'LinkedIn disconnected successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error disconnecting LinkedIn',
      error: error.message
    });
  }
};

// @desc    Toggle auto-post to LinkedIn
// @route   POST /api/linkedin/toggle-auto-post
// @access  Private
export const toggleAutoPost = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.linkedinAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Please connect your LinkedIn account first'
      });
    }

    user.autoPostToLinkedIn = !user.autoPostToLinkedIn;
    await user.save();

    res.json({
      success: true,
      autoPostToLinkedIn: user.autoPostToLinkedIn
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error toggling auto-post',
      error: error.message
    });
  }
};

// @desc    Refresh LinkedIn access token
// @route   POST /api/linkedin/refresh-token
// @desc    Refresh LinkedIn access token
// @route   POST /api/linkedin/refresh-token
// @access  Private (internal use)
export const refreshLinkedInToken = async (userId) => {
  try {
    const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
    const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
    
    const user = await User.findById(userId);
    
    if (!user.linkedinRefreshToken) {
      throw new Error('No refresh token available');
    }

    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.linkedinRefreshToken,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    );

    const tokenData = tokenResponse.data;

    user.linkedinAccessToken = tokenData.access_token;
    user.linkedinTokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000);
    await user.save();

    return tokenData.access_token;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
};

// @desc    Get LinkedIn posts
// @route   GET /api/linkedin/posts
// @access  Private
export const getLinkedInPosts = async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 10;
    const result = await fetchLinkedInPosts(req.user._id, count);

    res.json({
      success: true,
      count: result.count,
      posts: result.posts
    });
  } catch (error) {
    console.error('Error fetching LinkedIn posts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching LinkedIn posts'
    });
  }
};

// @desc    Sync LinkedIn posts (fetch latest posts from LinkedIn)
// @route   POST /api/linkedin/sync-posts
// @access  Private
export const syncLinkedInPosts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.linkedinAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Please connect your LinkedIn account first'
      });
    }

    const count = parseInt(req.body.count) || 20;
    const result = await fetchLinkedInPosts(req.user._id, count);

    res.json({
      success: true,
      message: 'LinkedIn posts synced successfully',
      count: result.count,
      posts: result.posts,
      syncedAt: new Date()
    });
  } catch (error) {
    console.error('Error syncing LinkedIn posts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error syncing LinkedIn posts'
    });
  }
};
