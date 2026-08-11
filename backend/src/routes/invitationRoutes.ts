import { Router } from "express";
import { invitationController } from "../controllers/invitationController";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// Create a new invitation (requires auth)
router.post("/", requireAuth, invitationController.createInvitation);

// Get invitation details by token (public, used for preview)
router.get("/:token", invitationController.getInvitation);

// Accept invitation (requires auth)
router.post("/:token/accept", requireAuth, invitationController.acceptInvitation);

// Decline invitation (requires auth)
router.post("/:token/decline", requireAuth, invitationController.declineInvitation);

// Revoke/Delete invitation (requires auth)
router.delete("/:invitationId", requireAuth, invitationController.revokeInvitation);

// Get project invitations (requires auth)
router.get("/project/:projectId", requireAuth, invitationController.getProjectInvitations);

// Get my invitations (both sent and received, requires auth)
router.get("/", requireAuth, invitationController.getMyInvitations);

export { router as invitationRoutes };
