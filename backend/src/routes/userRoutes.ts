import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import {
  getUserProfile,
  signUp,
  signIn,
  forgotPassword,
  updateProfile,
} from '../controllers/userController';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/forgot-password', forgotPassword);

// ── Protected ─────────────────────────────────────────────────────────────────
router.post('/signup',  requireAuth, signUp);
router.post('/signin',  requireAuth, signIn);
router.get('/profile',       requireAuth, getUserProfile);
router.patch('/profile',     requireAuth, updateProfile);

export default router;
