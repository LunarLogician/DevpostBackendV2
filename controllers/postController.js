import Post from '../models/Post.js';
import User from '../models/User.js';
import { postToLinkedIn } from '../services/linkedinService.js';
import Anthropic from '@anthropic-ai/sdk';

// @desc    Generate LinkedIn post using AI
// @route   POST /api/posts/generate
// @access  Private
export const generatePost = async (req, res) => {
  try {
    const { topic, tone, length } = req.body;
    const userId = req.user._id;

    // Validation
    if (!topic || !tone || !length) {
      return res.status(400).json({
        success: false,
        message: 'Please provide topic, tone, and length'
      });
    }

    // Check user's post limit
    const user = await User.findById(userId);
    
    if (!user.canGeneratePost()) {
      return res.status(403).json({
        success: false,
        message: 'Monthly post limit reached. Upgrade to Pro for unlimited posts!',
        limit: true
      });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    console.log(`📤 Topic: ${topic} Tone: ${tone} Length: ${length}`);
    
    const systemPrompt = `You are a LinkedIn ghostwriter for software developers. Write a high-engagement LinkedIn post about the given topic. Rules:
- NO hashtags
- NO markdown formatting
- Plain text only
- Use CAPS for emphasis
- Strong opening hook
- Short paragraphs
- End with a question
- Max 200 words`;

    const userPrompt = `Create a LinkedIn post with the following specifications:
- Topic: ${topic}
- Tone: ${tone}
- Length: ${length}

Return only the post content, nothing else.`;
    
    console.log('🔄 Calling Claude API...');
    
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    console.log('✅ Claude API Response received');
    
    const generatedContent = message.content[0].type === 'text' ? message.content[0].text : null;

    if (!generatedContent) {
      throw new Error('Invalid response from Claude API');
    }

    // Save post to database
    const post = await Post.create({
      userId,
      topic,
      tone,
      length,
      content: generatedContent
    });

    // Update user's post count
    user.postsGenerated += 1;
    user.monthlyPostsCount += 1;
    await user.save();

    // Auto-post to LinkedIn if enabled
    let linkedinPostUrl = null;
    if (user.autoPostToLinkedIn && user.linkedinAccessToken) {
      try {
        console.log('📤 Auto-posting to LinkedIn...');
        const linkedinResult = await postToLinkedIn(userId, generatedContent);
        linkedinPostUrl = linkedinResult.postUrl;
        console.log('✅ Posted to LinkedIn:', linkedinPostUrl);
      } catch (error) {
        console.error('❌ LinkedIn auto-post failed:', error.message);
        // Don't fail the whole request if LinkedIn posting fails
      }
    }

    res.status(201).json({
      success: true,
      data: post,
      linkedinPostUrl,
      remaining: ({ free: 5, starter: 20, pro: 50 }[user.plan] || 5) - user.monthlyPostsCount
    });

  } catch (error) {
    console.error('Error generating post:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating post'
    });
  }
};

// @desc    Get all posts for current user
// @route   GET /api/posts
// @access  Private
export const getPosts = async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      count: posts.length,
      data: posts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching posts',
      error: error.message
    });
  }
};

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Private
export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if post belongs to user
    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this post'
      });
    }

    res.json({
      success: true,
      data: post
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching post',
      error: error.message
    });
  }
};

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private
export const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if post belongs to user
    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this post'
      });
    }

    // Update content
    post.content = req.body.content || post.content;
    await post.save();

    res.json({
      success: true,
      data: post
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating post',
      error: error.message
    });
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if post belongs to user
    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    await post.deleteOne();

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting post',
      error: error.message
    });
  }
};

// @desc    Get user stats
// @route   GET /api/posts/stats
// @access  Private
export const getStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const totalPosts = await Post.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      data: {
        plan: user.plan,
        totalPosts,
        monthlyPostsUsed: user.monthlyPostsCount,
        monthlyPostsLimit: { free: 5, starter: 20, pro: 50 }[user.plan] || 5,
        remaining: ({ free: 5, starter: 20, pro: 50 }[user.plan] || 5) - user.monthlyPostsCount,
        linkedinConnected: !!user.linkedinAccessToken,
        autoPostToLinkedIn: user.autoPostToLinkedIn
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: error.message
    });
  }
};

// @desc    Manually post to LinkedIn
// @route   POST /api/posts/:id/post-to-linkedin
// @access  Private
export const manualPostToLinkedIn = async (req, res) => {
  try {
    console.log(`\n\n🟦 ===== MANUAL POST TO LINKEDIN START =====`);
    console.log(`📝 Step 1: Finding post ${req.params.id}`);
    
    const post = await Post.findById(req.params.id);

    if (!post) {
      console.log(`   ❌ Post not found`);
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    
    console.log(`   ✓ Post found: "${post.content.substring(0, 50)}..."`);

    // Check if post belongs to user
    if (post.userId.toString() !== req.user._id.toString()) {
      console.log(`   ❌ Post belongs to different user`);
      return res.status(403).json({
        success: false,
        message: 'Not authorized to post this'
      });
    }
    
    console.log(`   ✓ Post belongs to current user`);

    console.log(`\n📝 Step 2: Checking user LinkedIn connection`);
    const user = await User.findById(req.user._id);

    if (!user.linkedinAccessToken) {
      console.log(`   ❌ User has no LinkedIn token`);
      return res.status(400).json({
        success: false,
        message: 'Please connect your LinkedIn account first'
      });
    }
    
    console.log(`   ✓ User has LinkedIn token`);
    console.log(`   ✓ LinkedIn User ID: ${user.linkedinUserId}`);

    // Post to LinkedIn
    console.log(`\n📝 Step 3: Calling postToLinkedIn service`);
    const result = await postToLinkedIn(req.user._id, post.content);

    console.log(`   ✓ Post succeeded!`);
    console.log(`   URL: ${result.postUrl}`);

    res.json({
      success: true,
      linkedinPostUrl: result.postUrl,
      message: 'Successfully posted to LinkedIn!'
    });

  } catch (error) {
    console.error(`\n❌ ERROR in manualPostToLinkedIn:`, error.message);
    console.error(`   Full error:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error posting to LinkedIn'
    });
  }
};
