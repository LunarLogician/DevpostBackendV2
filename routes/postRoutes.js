import express from 'express';
import {
  generatePost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  getStats,
  manualPostToLinkedIn
} from '../controllers/postController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/generate', generatePost);
router.get('/', getPosts);
router.get('/stats', getStats);
router.get('/:id', getPost);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);
router.post('/:id/post-to-linkedin', manualPostToLinkedIn);

export default router;
