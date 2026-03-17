import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  tone: {
    type: String,
    required: true,
    enum: ['Educational', 'Storytelling', 'Opinion', 'Motivational', 'Technical', 'Casual']
  },
  length: {
    type: String,
    required: true,
    enum: ['Short', 'Medium', 'Long']
  },
  content: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Post = mongoose.model('Post', postSchema);

export default Post;
