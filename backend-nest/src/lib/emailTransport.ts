import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import React from "react";

const smtpHost = process.env.SMTP_HOST || "";
const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";
const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;

const hasSmtpConfig = Boolean(smtpHost && smtpUser && smtpPass);

export const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : null;

export async function sendEmail({
  to,
  subject,
  reactTemplate,
  fallbackLink,
  logLabel,
}: {
  to: string;
  subject: string;
  reactTemplate: React.ReactElement;
  fallbackLink?: string;
  logLabel?: string;
}): Promise<void> {
  const label = logLabel || "EMAIL DISPATCH";
  const fromEmail = process.env.SMTP_FROM || process.env.RESEND_FROM || `Cadence <${smtpUser || "onboarding@cadence.dev"}>`;

  // 1. Render React Email component to responsive HTML string
  let htmlContent = "";
  try {
    htmlContent = await render(reactTemplate);
  } catch (renderErr) {
    console.error(`[emailTransport] Error rendering React Email template for ${to}:`, renderErr);
  }

  // 2. Output clean terminal log for local development
  console.log(`\n=======================================================`);
  console.log(` 📧 [NODEMAILER + REACT EMAIL]: ${label}`);
  console.log(` To: ${to}`);
  console.log(` Subject: ${subject}`);
  if (fallbackLink) {
    console.log(` Action / Test Link:\n ${fallbackLink}`);
  }
  console.log(`=======================================================\n`);

  // 3. Dispatch email via Nodemailer if SMTP is configured
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html: htmlContent,
      });
      console.log(`[emailTransport] Email successfully delivered to ${to} via Nodemailer (MessageId: ${info.messageId})`);
    } catch (err: any) {
      console.error(`[emailTransport] Nodemailer SMTP Error delivering to ${to}:`, err.message || err);
    }
  } else {
    console.log(`[emailTransport] SMTP credentials not set (SMTP_HOST/SMTP_USER). Invitation link logged to terminal console above.`);
  }
}
