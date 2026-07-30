import { Router, raw, express } from "express";
import { requireAuth } from "../middlewares/authMiddleware";
import { createCheckoutSession, handleWebhook, getPortalSession } from "../controllers/stripeController";

const router = Router();
import bodyParser from "body-parser";

// Webhook needs raw body to verify signature
router.post("/webhook", bodyParser.raw({ type: 'application/json' }), handleWebhook);

// These need normal json, but since app.use(express.json()) comes AFTER /api/stripe in index.ts,
// we must add it specifically for these routes!
const jsonParser = bodyParser.json();

router.post("/checkout", jsonParser, requireAuth, createCheckoutSession);
router.post("/portal", jsonParser, requireAuth, getPortalSession);

export default router;
