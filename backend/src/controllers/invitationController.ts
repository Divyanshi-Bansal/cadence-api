import { Request, Response } from "express";
import { z, ZodError } from "zod";
import { prisma } from "../lib/prisma";
import { sendInvitationEmail } from "../lib/email";
import crypto from "crypto";
import { encryptDeterministic, decrypt } from "../lib/crypto";
import { formatUser } from "../lib/userFormat";
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

      if (!projectMember || (projectMember.role !== "OWNER" && projectMember.role !== "ADMIN")) {
        res.status(403).json({ error: "Insufficient permissions to invite members." });
        return;
      }

      // Enforce Plan Limits
      const canInvite = await checkCanInviteMember(projectId, inviterId);
      if (!canInvite) {
        res.status(403).json({ error: "LIMIT_REACHED", message: "Project member limit reached. Please upgrade the plan to invite more members." });
        return;
      }

      const inviter = await prisma.user.findUnique({ where: { id: inviterId } });
      const project = await prisma.project.findUnique({ where: { id: projectId } });

      if (!inviter || !project) {
        res.status(404).json({ error: "Project or user not found." });
        return;
      }

      // 2. Check if the invited email belongs to an existing user already in the project
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

      // 3. Check for existing pending invitation for this email
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

      let inviterName = "A team member";
      if (inviter.nameEncrypted) {
        try {
          inviterName = decrypt(inviter.nameEncrypted);
        } catch (e) {}
      }

      await sendInvitationEmail(email, inviterName, project.name, inviteLink);

      res.status(201).json({ message: "Invitation sent successfully.", invitationId: invitation.id, invitation });
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

      // Verify user exists and email matches
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
      if (error.code === 'P2002') {
        res.status(409).json({ error: "You are already a member of this project." });
        return;
      }
      console.error("Error accepting invitation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async declineInvitation(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token as string;
      const userId = req.userId;

      const invitation = await prisma.invitation.findUnique({ where: { token } });
      if (!invitation) {
        res.status(404).json({ error: "Invitation not found." });
        return;
      }

      if (invitation.status !== "PENDING") {
        res.status(400).json({ error: `Invitation is already ${invitation.status.toLowerCase()}.` });
        return;
      }

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "DECLINED" },
      });

      res.json({ message: "Invitation declined successfully." });
    } catch (error) {
      console.error("Error declining invitation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async revokeInvitation(req: Request, res: Response): Promise<void> {
    try {
      const invitationId = req.params.invitationId as string;
      const userId = req.userId;

      const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
      if (!invitation) {
        res.status(404).json({ error: "Invitation not found." });
        return;
      }

      let canRevoke = invitation.invitedById === userId;
      if (!canRevoke && invitation.projectId) {
        const member = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: invitation.projectId, userId } },
        });
        if (member && (member.role === "OWNER" || member.role === "ADMIN")) {
          canRevoke = true;
        }
      }

      if (!canRevoke) {
        res.status(403).json({ error: "Insufficient permissions to revoke this invitation." });
        return;
      }

      await prisma.invitation.delete({ where: { id: invitationId } });

      res.json({ message: "Invitation revoked successfully." });
    } catch (error) {
      console.error("Error revoking invitation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async getProjectInvitations(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const userId = req.userId;

      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
      });
      if (!member) {
        res.status(403).json({ error: "Access denied." });
        return;
      }

      const invitations = await prisma.invitation.findMany({
        where: { projectId },
        include: {
          invitedBy: { select: { id: true, nameEncrypted: true, emailEncrypted: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const formatted = invitations.map((inv) => {
        let inviterName = null;
        if (inv.invitedBy && inv.invitedBy.nameEncrypted) {
          try {
            inviterName = decrypt(inv.invitedBy.nameEncrypted);
          } catch (e) {}
        }
        return {
          id: inv.id,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          token: inv.token,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
          invitedBy: inviterName || "Team Admin",
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error("Error fetching project invitations:", error);
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

      const formattedUser = formatUser(user);
      const plaintextEmail = formattedUser.email;

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
