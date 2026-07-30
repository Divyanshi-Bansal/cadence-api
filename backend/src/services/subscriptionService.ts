import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STRIPE_PRICE_ID_FREE = process.env.STRIPE_PRICE_ID_FREE;
const STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO;
const STRIPE_PRICE_ID_ENTERPRISE = process.env.STRIPE_PRICE_ID_ENTERPRISE;

// Limits based on plan
const PLAN_LIMITS = {
  FREE: { projects: 1, members: 2 },
  PRO: { projects: 10, members: 10 },
  ENTERPRISE: { projects: Infinity, members: Infinity },
};

export const getUserPlan = async (userId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  // If no subscription or status is canceled/past_due, default to FREE
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";
  
  if (!subscription || !isActive) {
    return { name: "FREE", limits: PLAN_LIMITS.FREE };
  }

  if (subscription.stripePriceId === STRIPE_PRICE_ID_ENTERPRISE) {
    return { name: "ENTERPRISE", limits: PLAN_LIMITS.ENTERPRISE };
  } else if (subscription.stripePriceId === STRIPE_PRICE_ID_PRO) {
    return { name: "PRO", limits: PLAN_LIMITS.PRO };
  }

  return { name: "FREE", limits: PLAN_LIMITS.FREE };
};

export const checkCanCreateProject = async (userId: string): Promise<boolean> => {
  const plan = await getUserPlan(userId);

  if (plan.limits.projects === Infinity) return true;

  // Count projects where user is OWNER
  const projectCount = await prisma.projectMember.count({
    where: {
      userId,
      role: "OWNER",
    },
  });

  return projectCount < plan.limits.projects;
};

export const checkCanInviteMember = async (projectId: string, inviterId: string): Promise<boolean> => {
  // Find the owner of this project to check their limits
  const ownerRecord = await prisma.projectMember.findFirst({
    where: { projectId, role: "OWNER" },
  });

  // If no owner found (unlikely), fallback to checking the inviter
  const targetUserId = ownerRecord ? ownerRecord.userId : inviterId;
  
  const plan = await getUserPlan(targetUserId);

  if (plan.limits.members === Infinity) return true;

  // Count active members in this project
  const memberCount = await prisma.projectMember.count({
    where: { projectId },
  });

  // Also count pending invitations for this project
  const pendingInvites = await prisma.invitation.count({
    where: { projectId, status: "PENDING" },
  });

  const totalMembers = memberCount + pendingInvites;

  return totalMembers < plan.limits.members;
};
