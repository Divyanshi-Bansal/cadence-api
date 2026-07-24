import { Router } from "express";
import {
  signup,
  login,
  requestMagicLink,
  verifyMagicLink,
  refresh,
  logout,
  getMe,
  googleAuth,
  githubCallback,
  githubExchange,
  authRateLimiter,
} from "../controllers/authController";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

/**
 * ── Rate-Limited Auth Routes ───────────────────────────────────────────────
 * Defends against credential stuffing and password brute-force attacks.
 */
router.post("/signup", authRateLimiter, signup);
router.post("/login", authRateLimiter, login);
router.post("/magic-link", authRateLimiter, requestMagicLink);
router.post("/verify-magic-link", verifyMagicLink);

/**
 * ── Cookie-Based Auth & Session Routes ──────────────────────────────────────
 */
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, getMe);

/**
 * ── OAuth Routes ───────────────────────────────────────────────────────────
 */
router.post("/google", googleAuth);
router.get("/github/callback", githubCallback);
router.post("/github/exchange", githubExchange);

export default router;
