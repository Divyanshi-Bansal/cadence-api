import React from "react";
import { sendEmail } from "../lib/emailTransport";
import { RaycastMagicLinkEmail } from "../emails/RaycastMagicLink";

export async function sendMagicLinkEmail(
  email: string,
  magicLink: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Your Magic Login Link for Cadence",
    reactTemplate: React.createElement(RaycastMagicLinkEmail, {
      magicLink,
      userEmail: email,
    }),
    fallbackLink: magicLink,
    logLabel: "RAYCAST MAGIC LINK DISPATCH",
  });
}
