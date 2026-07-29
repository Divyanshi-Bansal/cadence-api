import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const sendInvitationEmail = async (
  toEmail: string,
  inviterName: string,
  projectName: string,
  inviteLink: string
) => {
  if (!resend) {
    console.warn("RESEND_API_KEY is not set. Email not sent.");
    console.log(`[Mock Email] To: ${toEmail}`);
    console.log(`[Mock Email] Link: ${inviteLink}`);
    return;
  }

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #172B4D;">You've been invited to join a project on Cadence!</h2>
      <p style="color: #5E6C84; font-size: 16px; line-height: 1.5;">
        Hi there,
      </p>
      <p style="color: #5E6C84; font-size: 16px; line-height: 1.5;">
        <strong>${inviterName}</strong> has invited you to collaborate on the project <strong>${projectName}</strong>.
      </p>
      <div style="margin: 32px 0;">
        <a href="${inviteLink}" style="background-color: #0052CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
          Accept Invitation
        </a>
      </div>
      <p style="color: #5E6C84; font-size: 14px; line-height: 1.5;">
        If you don't have an account yet, you'll be able to create one before joining the project.
      </p>
      <hr style="border: none; border-top: 1px solid #DFE1E6; margin: 32px 0;" />
      <p style="color: #7A869A; font-size: 12px;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Cadence <onboarding@resend.dev>",
      to: [toEmail],
      subject: `You've been invited to ${projectName} on Cadence`,
      html: htmlContent,
    });
    console.log(`Invitation email sent to ${toEmail}`);
  } catch (error) {
    console.error("Error sending invitation email:", error);
    throw new Error("Failed to send invitation email.");
  }
};
