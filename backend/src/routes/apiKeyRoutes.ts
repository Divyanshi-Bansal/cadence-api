import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { apiKeyController } from "../controllers/apiKeyController";

const router = Router();

router.post("/", requireAuth, apiKeyController.createKey);
router.get("/", requireAuth, apiKeyController.listKeys);
router.delete("/:id", requireAuth, apiKeyController.revokeKey);

export default router;
