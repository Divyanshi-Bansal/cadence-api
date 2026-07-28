import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import {
  getUserProfile,
  forgotPassword,
  updateProfile,
} from "../controllers/userController";

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.post("/forgot-password", forgotPassword);

// ── Protected ─────────────────────────────────────────────────────────────────
router.get("/profile", requireAuth, getUserProfile);
router.patch("/profile", requireAuth, updateProfile);

export default router;
