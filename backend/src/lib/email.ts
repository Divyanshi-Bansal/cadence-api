import React from "react";
import { sendEmail } from "./emailTransport";
import { ProjectInvitationEmail } from "../emails/ProjectInvitationEmail";
import {
  CadenceSubscriptionEmail,
  SubscriptionEventType,
} from "../emails/CadenceSubscriptionEmail";
import { CadenceMagicLinkEmail } from "../emails/CadenceMagicLinkEmail";
import { CadencePasswordResetEmail } from "../emails/CadencePasswordResetEmail";
import { CadenceProjectCreatedEmail } from "../emails/CadenceProjectCreatedEmail";
import {
  CadenceTaskNotificationEmail,
  TaskActionType,
} from "../emails/CadenceTaskNotificationEmail";

/**
 * 1. Invitation Email
 */
export const sendInvitationEmail = async (
  toEmail: string,
  inviterName: string,
  projectName: string,
  inviteLink: string
): Promise<void> => {
  await sendEmail({
    to: toEmail,
    subject: `You've been invited to ${projectName} on Cadence`,
    reactTemplate: React.createElement(ProjectInvitationEmail, {
      inviterName,
      projectName,
      inviteLink,
    }),
    fallbackLink: inviteLink,
    logLabel: "PROJECT INVITATION DISPATCH",
  });
};

/**
 * 2. Subscription & Billing Email
 */
export const sendSubscriptionNotificationEmail = async ({
  toEmail,
  userName,
  planName = "PRO",
  amountPaid = "$19.00",
  billingPeriodEnd,
  eventType = "NEW_SUBSCRIPTION",
  failureReason,
}: {
  toEmail: string;
  userName?: string;
  planName?: string;
  amountPaid?: string;
  billingPeriodEnd?: string;
  eventType?: SubscriptionEventType;
  failureReason?: string;
}): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const dashboardUrl = `${frontendUrl}/projects/billing`;

  const getSubject = () => {
    switch (eventType) {
      case "NEW_SUBSCRIPTION":
        return `🎉 Welcome to Cadence ${planName}!`;
      case "UPGRADE":
        return `🚀 Your Cadence Subscription has been upgraded to ${planName}`;
      case "DOWNGRADE":
        return `ℹ️ Your Cadence Subscription has been updated to ${planName}`;
      case "CANCELLATION":
        return `⚠️ Your Cadence ${planName} Subscription has been Canceled`;
      case "PAYMENT_SUCCESS":
        return `🧾 Payment Receipt for Cadence ${planName} (${amountPaid})`;
      case "PAYMENT_FAILED":
        return `❌ Action Required: Cadence Payment Failed (${amountPaid})`;
      default:
        return `Cadence Subscription Notification`;
    }
  };

  await sendEmail({
    to: toEmail,
    subject: getSubject(),
    reactTemplate: React.createElement(CadenceSubscriptionEmail, {
      userName: userName || "Valued Member",
      planName,
      amountPaid,
      billingPeriodEnd: billingPeriodEnd || "the end of the current billing cycle",
      dashboardUrl,
      eventType,
      failureReason,
    }),
    fallbackLink: dashboardUrl,
    logLabel: `SUBSCRIPTION ${eventType} DISPATCH`,
  });
};

/**
 * 3. Magic Link Authentication Email
 */
export const sendMagicLinkEmail = async (
  toEmail: string,
  magicLink: string
): Promise<void> => {
  await sendEmail({
    to: toEmail,
    subject: "🪄 Your Cadence Magic Login Link",
    reactTemplate: React.createElement(CadenceMagicLinkEmail, {
      userEmail: toEmail,
      magicLink,
    }),
    fallbackLink: magicLink,
    logLabel: "MAGIC LINK DISPATCH",
  });
};

/**
 * 4. Password Reset Email
 */
export const sendPasswordResetEmail = async (
  toEmail: string,
  userName: string,
  resetLink: string
): Promise<void> => {
  await sendEmail({
    to: toEmail,
    subject: "🔑 Reset Your Cadence Password",
    reactTemplate: React.createElement(CadencePasswordResetEmail, {
      userName,
      resetLink,
    }),
    fallbackLink: resetLink,
    logLabel: "PASSWORD RESET DISPATCH",
  });
};

/**
 * 5. Project Created Email
 */
export const sendProjectCreatedEmail = async (
  toEmail: string,
  ownerName: string,
  projectName: string,
  projectKey: string,
  projectId: string
): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const projectUrl = `${frontendUrl}/projects/${projectId}/board`;

  await sendEmail({
    to: toEmail,
    subject: `🚀 Project Created: ${projectName} [${projectKey}]`,
    reactTemplate: React.createElement(CadenceProjectCreatedEmail, {
      ownerName,
      projectName,
      projectKey,
      projectUrl,
    }),
    fallbackLink: projectUrl,
    logLabel: "PROJECT CREATED DISPATCH",
  });
};

/**
 * 6. Task Activity & AI Copilot Changes Email
 */
export const sendTaskNotificationEmail = async ({
  toEmail,
  recipientName,
  actorName = "Cadence User",
  taskKey = "CAD-101",
  taskTitle,
  actionType = "ASSIGNED",
  oldValue,
  newValue,
  commentBody,
  projectId,
  taskId,
}: {
  toEmail: string;
  recipientName?: string;
  actorName?: string;
  taskKey: string;
  taskTitle: string;
  actionType: TaskActionType;
  oldValue?: string;
  newValue?: string;
  commentBody?: string;
  projectId?: string;
  taskId?: string;
}): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const taskUrl = projectId && taskId
    ? `${frontendUrl}/projects/${projectId}/board?task=${taskId}`
    : `${frontendUrl}/projects`;

  await sendEmail({
    to: toEmail,
    subject: `📋 Task Update: [${taskKey}] ${taskTitle}`,
    reactTemplate: React.createElement(CadenceTaskNotificationEmail, {
      recipientName: recipientName || "Team Member",
      actorName,
      taskKey,
      taskTitle,
      actionType,
      oldValue,
      newValue,
      commentBody,
      taskUrl,
    }),
    fallbackLink: taskUrl,
    logLabel: `TASK NOTIFICATION [${actionType}] DISPATCH`,
  });
};
