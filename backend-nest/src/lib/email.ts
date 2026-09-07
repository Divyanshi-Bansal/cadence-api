import React from "react";
import { sendEmail } from "./emailTransport";
import { ProjectInvitationEmail } from "../emails/ProjectInvitationEmail";

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
