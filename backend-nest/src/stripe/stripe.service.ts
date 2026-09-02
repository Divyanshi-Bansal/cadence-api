import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

const PLAN_LIMITS = {
  FREE: { projects: 1, members: 2 },
  PRO: { projects: 10, members: 10 },
  ENTERPRISE: { projects: Infinity, members: Infinity },
};

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly prisma: PrismaService) {
    const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2024-04-10' as any,
    });
  }

  get stripeClient() {
    return this.stripe;
  }

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

  async syncUserSubscriptionFromStripe(userId: string, sessionId?: string) {
    try {
      if (sessionId) {
        const session = await this.stripe.checkout.sessions.retrieve(sessionId);
        if (session && session.subscription && session.customer) {
          const sub = await this.stripe.subscriptions.retrieve(session.subscription as string);
          const customerId = session.customer as string;
          const priceId = sub.items.data[0]?.price?.id;

          return await this.prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: sub.id,
              stripePriceId: priceId,
              status: sub.status,
              currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
            },
            update: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: sub.id,
              stripePriceId: priceId,
              status: sub.status,
              currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
            },
          });
        }
      }

      let dbSub = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (dbSub?.stripeSubscriptionId) {
        const stripeSub = await this.stripe.subscriptions.retrieve(dbSub.stripeSubscriptionId);
        const priceId = stripeSub.items.data[0]?.price?.id;

        return await this.prisma.subscription.update({
          where: { userId },
          data: {
            stripePriceId: priceId || dbSub.stripePriceId,
            status: stripeSub.status,
            currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
          },
        });
      }

      const sessions = await this.stripe.checkout.sessions.list({
        client_reference_id: userId,
        limit: 10,
      } as any);

      const completedSession = sessions.data.find(
        (s) => (s.status === 'complete' || s.payment_status === 'paid') && s.subscription
      );

      if (completedSession && completedSession.subscription) {
        const sub = await this.stripe.subscriptions.retrieve(completedSession.subscription as string);
        const customerId = completedSession.customer as string;
        const priceId = sub.items.data[0]?.price?.id;

        return await this.prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            status: sub.status,
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          },
          update: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            status: sub.status,
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          },
        });
      }

      if (dbSub?.stripeCustomerId) {
        const customerSubs = await this.stripe.subscriptions.list({
          customer: dbSub.stripeCustomerId,
          status: 'active',
          limit: 1,
        });

        if (customerSubs.data.length > 0) {
          const sub = customerSubs.data[0];
          const priceId = sub.items.data[0]?.price?.id;

          return await this.prisma.subscription.update({
            where: { userId },
            data: {
              stripeSubscriptionId: sub.id,
              stripePriceId: priceId,
              status: sub.status,
              currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
            },
          });
        }
      }

      const recentSessions = await this.stripe.checkout.sessions.list({ limit: 10 });
      const matchedSession = recentSessions.data.find(
        (s) => (s.status === 'complete' || s.payment_status === 'paid') && s.subscription
      );

      if (matchedSession && matchedSession.subscription) {
        const sub = await this.stripe.subscriptions.retrieve(matchedSession.subscription as string);
        const customerId = matchedSession.customer as string;
        const priceId = sub.items.data[0]?.price?.id;

        return await this.prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            status: sub.status,
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          },
          update: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            status: sub.status,
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`syncUserSubscriptionFromStripe warning: ${err.message}`);
    }
  }
}
