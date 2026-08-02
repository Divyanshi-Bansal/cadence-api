import { Request, Response } from "express";
import { z, ZodError } from "zod";
import { prisma } from "../lib/prisma";
import { sendInvitationEmail } from "../lib/email";
import crypto from "crypto";
import { encryptDeterministic } from "../lib/crypto";
import { checkCanInviteMember } from "../services/subscriptionService";
import { userRepository } from "../repositories/userRepository";

const createInvitationSchema = z.object({
  projectId: z.string().cuid(),
  email: z.string().email(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export const invitationController = {
  async createInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, email, role } = createInvitationSchema.parse(req.body);
      const inviterId = req.userId;

      // 1. Verify inviter permissions (must be OWNER or ADMIN of the project)
      const projectMember = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: { projectId, userId: inviterId },
        },
      });

      // Enforce Plan Limits
      const canInvite = await checkCanInviteMember(projectId, inviterId);
      if (!canInvite) {
        res.status(403).json({ error: "LIMIT_REACHED", message: "Project member limit reached. Please upgrade the plan to invite more members." });
        return;
      }

      if (!projectMember || (projectMember.role !== "OWNER" && projectMember.role !== "ADMIN")) {
        res.status(403).json({ error: "Insufficient permissions to invite members." });
        return;
      }

      const inviter = await prisma.user.findUnique({ where: { id: inviterId } });
      const project = await prisma.project.findUnique({ where: { id: projectId } });

      if (!inviter || !project) {
        res.status(404).json({ error: "Project or user not found." });
        return;
      }

      // 2. Check if the invited email is already a member
      const existingUser = await userRepository.findByEmail(email);

      if (existingUser) {
        const existingMember = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: existingUser.id } },
        });
        if (existingMember) {
          res.status(409).json({ error: "User is already a member of this project." });
          return;
        }
      }

      // 3. Check for existing pending invitation
      const existingInvitation = await prisma.invitation.findFirst({
        where: {
          projectId,
          email,
          status: "PENDING",
        },
      });

      if (existingInvitation) {
        res.status(409).json({ error: "A pending invitation already exists for this email." });
        return;
      }

      // 4. Create new invitation
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      const invitation = await prisma.invitation.create({
        data: {
          email,
          projectId,
          role,
          invitedById: inviterId,
          token,
          expiresAt,
          status: "PENDING",
        },
      });

      // 5. Send email
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const inviteLink = `${frontendUrl}/invite/accept?token=${token}`;

      // In real scenario, user's name is encrypted, but for the email, we don't have it unencrypted here directly unless we decrypt it or just use 'A team member'.
      // Wait, we need to decrypt inviter's name or just pass a generic name if we can't.
      // Let's use a generic name or "A colleague" if decrypting here is too much overhead.
      const { decrypt } = require("../lib/crypto");
      const inviterName = inviter.nameEncrypted ? decrypt(inviter.nameEncrypted) : "A team member";

      await sendInvitationEmail(email, inviterName, project.name, inviteLink);

      res.status(201).json({ message: "Invitation sent successfully.", invitationId: invitation.id });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: "Validation error", details: error.issues });
        return;
      }
      console.error("Error creating invitation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async getInvitation(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token as string;
      const invitation = await prisma.invitation.findUnique({
        where: { token },
        include: { project: true },
      });

      if (!invitation) {
        res.status(404).json({ error: "Invitation not found." });
        return;
      }

      res.json({
        id: invitation.id,
        email: invitation.email,
        projectName: invitation.project?.name,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      console.error("Error fetching invitation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async acceptInvitation(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token as string;
      const userId = req.userId;

      const invitation = await prisma.invitation.findUnique({ where: { token } });

      if (!invitation || !invitation.projectId) {
        res.status(404).json({ error: "Invitation not found." });
        return;
      }

      if (invitation.status !== "PENDING") {
        res.status(400).json({ error: `Invitation is already ${invitation.status.toLowerCase()}.` });
        return;
      }

      if (new Date() > invitation.expiresAt) {
        await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
        res.status(400).json({ error: "Invitation has expired." });
        return;
      }

      // Verify email matches
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const invitationEmailEncrypted = encryptDeterministic(invitation.email);
      if (user.emailEncrypted !== invitationEmailEncrypted) {
        res.status(403).json({ error: "This invitation was sent to a different email address." });
        return;
      }

      // Create project member and update invitation status atomically
      await prisma.$transaction([
        prisma.projectMember.create({
          data: {
            projectId: invitation.projectId,
            userId: user.id,
            role: invitation.role as any, // ProjectRole enum
          },
        }),
        prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED" },
        }),
      ]);

      res.json({ message: "Invitation accepted successfully.", projectId: invitation.projectId });
    } catch (error: any) {
      // Handle unique constraint if user clicked multiple times or is already a member
      if (error.code === 'P2002') {
        res.status(409).json({ error: "You are already a member of this project." });
        return;
      }
      console.error("Error accepting invitation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async getMyInvitations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const { decrypt } = require("../lib/crypto");
      const plaintextEmail = decrypt(user.emailEncrypted);

      const [received, sent] = await Promise.all([
        prisma.invitation.findMany({
          where: { email: plaintextEmail },
          include: {
            project: { select: { id: true, name: true } },
            invitedBy: { select: { id: true, nameEncrypted: true, emailEncrypted: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.invitation.findMany({
          where: { invitedById: userId },
          include: {
            project: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Format received invitations to decrypt inviter name if available
      const formattedReceived = received.map((inv) => {
        let inviterName = null;
        if (inv.invitedBy && inv.invitedBy.nameEncrypted) {
          try {
            inviterName = decrypt(inv.invitedBy.nameEncrypted);
          } catch (e) {
            console.error("Failed to decrypt inviter name", e);
          }
        }
        return {
          ...inv,
          invitedBy: inv.invitedBy
            ? {
                id: inv.invitedBy.id,
                emailEncrypted: inv.invitedBy.emailEncrypted,
                name: inviterName,
              }
            : null,
        };
      });

      res.json({ received: formattedReceived, sent });
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};
