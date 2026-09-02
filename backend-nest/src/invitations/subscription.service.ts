import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PLAN_LIMITS = {
  FREE: { projects: 1, members: 2 },
  PRO: { projects: 10, members: 10 },
  ENTERPRISE: { projects: Infinity, members: Infinity },
};

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPlan(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    const STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO;
    const STRIPE_PRICE_ID_ENTERPRISE = process.env.STRIPE_PRICE_ID_ENTERPRISE;

    const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';

    if (!subscription || !isActive) {
      return { name: 'FREE', limits: PLAN_LIMITS.FREE, currentPeriodEnd: null };
    }

    if (subscription.stripePriceId && subscription.stripePriceId === STRIPE_PRICE_ID_ENTERPRISE) {
      return { name: 'ENTERPRISE', limits: PLAN_LIMITS.ENTERPRISE, currentPeriodEnd: subscription.currentPeriodEnd };
    } else if (subscription.stripePriceId && subscription.stripePriceId === STRIPE_PRICE_ID_PRO) {
      return { name: 'PRO', limits: PLAN_LIMITS.PRO, currentPeriodEnd: subscription.currentPeriodEnd };
    }

    return { name: 'FREE', limits: PLAN_LIMITS.FREE, currentPeriodEnd: null };
  }

  async checkCanCreateProject(userId: string): Promise<boolean> {
    const plan = await this.getUserPlan(userId);

    if (plan.limits.projects === Infinity) return true;

    const projectCount = await this.prisma.projectMember.count({
      where: {
        userId,
        role: 'OWNER',
      },
    });

    return projectCount < plan.limits.projects;
  }

  async checkCanInviteMember(projectId: string, inviterId: string): Promise<boolean> {
    const ownerRecord = await this.prisma.projectMember.findFirst({
      where: { projectId, role: 'OWNER' },
    });

    const targetUserId = ownerRecord ? ownerRecord.userId : inviterId;
    const plan = await this.getUserPlan(targetUserId);

    if (plan.limits.members === Infinity) return true;

    const memberCount = await this.prisma.projectMember.count({
      where: { projectId },
    });

    const pendingInvites = await this.prisma.invitation.count({
      where: { projectId, status: 'PENDING' },
    });

    const totalMembers = memberCount + pendingInvites;

    return totalMembers < plan.limits.members;
  }
}
