import React from "react";
import { sendEmail } from "./emailTransport";
import { ProjectInvitationEmail } from "../emails/ProjectInvitationEmail";
import { InvitationAcceptedEmail } from "../emails/InvitationAcceptedEmail";

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

export const sendInvitationAcceptedEmail = async (
  toEmail: string,
  userName: string,
  projectName: string,
  role: string,
  projectLink: string
): Promise<void> => {
  await sendEmail({
    to: toEmail,
    subject: `You've joined ${projectName} on Cadence`,
    reactTemplate: React.createElement(InvitationAcceptedEmail, {
      userName,
      projectName,
      role,
      projectLink,
    }),
    fallbackLink: projectLink,
    logLabel: "INVITATION ACCEPTED CONFIRMATION DISPATCH",
  });
};
