import { Injectable, ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { SubscriptionService } from './subscription.service';
import { sendInvitationEmail } from '../lib/email';
import * as crypto from 'crypto';
import { encryptDeterministic, decrypt } from '../lib/crypto';
import { formatUser } from '../lib/userFormat';
import { userRepository } from '../repositories/userRepository';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async createInvitation(userId: string, dto: CreateInvitationDto) {
    const { projectId, email, role } = dto;

    const projectMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    if (!projectMember || (projectMember.role !== 'OWNER' && projectMember.role !== 'ADMIN')) {
      throw new ForbiddenException('Insufficient permissions to invite members.');
    }

    const canInvite = await this.subscriptionService.checkCanInviteMember(projectId, userId);
    if (!canInvite) {
      throw new ForbiddenException({ error: 'LIMIT_REACHED', message: 'Project member limit reached. Please upgrade the plan to invite more members.' });
    }

    const inviter = await this.prisma.user.findUnique({ where: { id: userId } });
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });

    if (!inviter || !project) {
      throw new NotFoundException('Project or user not found.');
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      const existingMember = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: existingUser.id } },
      });
      if (existingMember) {
        throw new ConflictException('User is already a member of this project.');
      }
    }

    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        projectId,
        email,
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      throw new ConflictException('A pending invitation already exists for this email.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.invitation.create({
      data: {
        email,
        projectId,
        role: role as any,
        invitedById: userId,
        token,
        expiresAt,
        status: 'PENDING',
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteLink = `${frontendUrl}/invite/accept?token=${token}`;

    let inviterName = 'A team member';
    if (inviter.nameEncrypted) {
      try {
        inviterName = decrypt(inviter.nameEncrypted);
      } catch (e) {}
    }

    await sendInvitationEmail(email, inviterName, project.name, inviteLink);

    return { message: 'Invitation sent successfully.', invitationId: invitation.id, invitation };
  }

  async getInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { project: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    return {
      id: invitation.id,
      email: invitation.email,
      projectName: invitation.project?.name,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(userId: string, token: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });

    if (!invitation || !invitation.projectId) {
      throw new NotFoundException('Invitation not found.');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(`Invitation is already ${invitation.status.toLowerCase()}.`);
    }

    if (new Date() > invitation.expiresAt) {
      await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('Invitation has expired.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const invitationEmailEncrypted = encryptDeterministic(invitation.email);
    if (user.emailEncrypted !== invitationEmailEncrypted) {
      throw new ForbiddenException('This invitation was sent to a different email address.');
    }

    try {
      await this.prisma.$transaction([
        this.prisma.projectMember.create({
          data: {
            projectId: invitation.projectId,
            userId: user.id,
            role: invitation.role as any,
          },
        }),
        this.prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED' },
        }),
      ]);
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('You are already a member of this project.');
      }
      throw error;
    }

    return { message: 'Invitation accepted successfully.', projectId: invitation.projectId };
  }

  async declineInvitation(userId: string, token: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(`Invitation is already ${invitation.status.toLowerCase()}.`);
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'DECLINED' },
    });

    return { message: 'Invitation declined successfully.' };
  }

  async revokeInvitation(userId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    let canRevoke = invitation.invitedById === userId;
    if (!canRevoke && invitation.projectId) {
      const member = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: invitation.projectId, userId } },
      });
      if (member && (member.role === 'OWNER' || member.role === 'ADMIN')) {
        canRevoke = true;
      }
    }

    if (!canRevoke) {
      throw new ForbiddenException('Insufficient permissions to revoke this invitation.');
    }

    await this.prisma.invitation.delete({ where: { id: invitationId } });

    return { message: 'Invitation revoked successfully.' };
  }

  async getProjectInvitations(userId: string, projectId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('Access denied.');
    }

    const invitations = await this.prisma.invitation.findMany({
      where: { projectId },
      include: {
        invitedBy: { select: { id: true, nameEncrypted: true, emailEncrypted: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv: any) => {
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
        invitedBy: inviterName || 'Team Admin',
      };
    });
  }

  async getMyInvitations(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const formattedUser = formatUser(user);
    const plaintextEmail = formattedUser.email;

    const [received, sent] = await Promise.all([
      this.prisma.invitation.findMany({
        where: { email: plaintextEmail },
        include: {
          project: { select: { id: true, name: true } },
          invitedBy: { select: { id: true, nameEncrypted: true, emailEncrypted: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invitation.findMany({
        where: { invitedById: userId },
        include: {
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedReceived = received.map((inv: any) => {
      let inviterName = null;
      if (inv.invitedBy && inv.invitedBy.nameEncrypted) {
        try {
          inviterName = decrypt(inv.invitedBy.nameEncrypted);
        } catch (e) {
          console.error('Failed to decrypt inviter name', e);
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

    return { received: formattedReceived, sent };
  }
}
