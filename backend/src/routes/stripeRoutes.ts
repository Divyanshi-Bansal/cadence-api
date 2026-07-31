import express, { Router, raw } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { createCheckoutSession, handleWebhook, getPortalSession, getSubscriptionPlan, getBillingHistory, previewProration, updateSubscription } from "../controllers/stripeController";

const router = Router();
import bodyParser from "body-parser";

// Webhook needs raw body to verify signature
router.post("/webhook", bodyParser.raw({ type: 'application/json' }), handleWebhook);

// These need normal json, but since app.use(express.json()) comes AFTER /api/stripe in index.ts,
// we must add it specifically for these routes!
const jsonParser = bodyParser.json();

router.post("/checkout", jsonParser, requireAuth, createCheckoutSession);
router.post("/update-subscription", jsonParser, requireAuth, updateSubscription);
router.post("/portal", jsonParser, requireAuth, getPortalSession);
router.get("/plan", jsonParser, requireAuth, getSubscriptionPlan);
router.get("/history", jsonParser, requireAuth, getBillingHistory);
router.get("/preview-proration", jsonParser, requireAuth, previewProration);

export default router;
