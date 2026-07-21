import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { handleClerkWebhook } from "./lib/clerkWebhook";
import userRoutes from "./routes/userRoutes";
import projectRoutes from "./routes/projectRoutes";

dotenv.config();

const app = express();
app.use(cors());

// ── Clerk Webhook ─────────────────────────────────────────────────────────────
// IMPORTANT: This route must be registered BEFORE express.json() so that svix
// receives the raw Buffer body it needs to verify the HMAC signature.
app.post(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  handleClerkWebhook,
);

app.use(express.json());

const PORT = process.env.PORT || 4000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/users", userRoutes);
app.use('/api/projects', projectRoutes);

app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});
