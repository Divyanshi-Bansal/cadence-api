import { Router } from "express";
import {
  signup,
  login,
  refresh,
  logout,
  googleAuth,
  githubCallback,
  githubExchange,
  getMe,
  authRateLimiter,
} from "../controllers/authController";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

/**
 * ── Rate-Limited Auth Routes ───────────────────────────────────────────────
 * Defends against credential stuffing and password brute-force attacks.
 * Limit: 5 requests per 15 minutes per IP address.
 */
router.post("/signup", authRateLimiter, signup);
router.post("/login", authRateLimiter, login);

/**
 * ── Cookie-Based Auth Routes & CSRF Protection Notice ──────────────────────
 * Note: Refresh tokens are stored in SameSite=Strict, HttpOnly cookies.
 * State-changing endpoints using cookie auth (e.g., refresh & logout) are
 * protected against CSRF via SameSite=Strict cookies + origin verification.
 */
router.post("/refresh", refresh);
router.post("/logout", logout);

/**
 * ── OAuth Routes ───────────────────────────────────────────────────────────
 */
router.post("/google", googleAuth);
router.get("/github/callback", githubCallback);
router.post("/github/exchange", githubExchange);

/**
 * ── User Session Route ─────────────────────────────────────────────────────
 */
router.get("/me", requireAuth, getMe);

export default router;
