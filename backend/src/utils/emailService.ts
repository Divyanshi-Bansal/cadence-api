import React from "react";
import { Resend } from "resend";
import { RaycastMagicLinkEmail } from "../emails/RaycastMagicLink";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy");

export async function sendMagicLinkEmail(
  email: string,
  magicLink: string,
): Promise<void> {
  const fromEmail = process.env.RESEND_FROM || "Cadence <onboarding@resend.dev>";
  const subject = "Your Magic Login Link for Cadence";

  console.log("\n=======================================================");
  console.log(" 🪄 REACT EMAIL + RESEND: RAYCAST MAGIC LINK DISPATCH");
  console.log(` To: ${email}`);
  console.log(` Magic Link URL:\n ${magicLink}`);
  console.log("=======================================================\n");

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject,
      react: React.createElement(RaycastMagicLinkEmail, {
        magicLink,
        userEmail: email,
      }),
    });

    if (error) {
      console.error(`[EmailService] Resend API error sending to ${email}:`, error);
    } else {
      console.log(`[EmailService] Magic link email successfully sent via Resend to ${email}:`, data);
    }
  } catch (err) {
    console.error(`[EmailService] Failed to send email via Resend API:`, err);
  }
}
