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
    console.log(`\n========================================`);
    console.log(`[MOCK EMAIL INVITATION LINK]:`);
    console.log(`To: ${toEmail}`);
    console.log(`Link: ${inviteLink}`);
    console.log(`========================================\n`);
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "Cadence <onboarding@resend.dev>";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #DFE1E6;">
      <h2 style="color: #172B4D; margin-top: 0;">You've been invited to join a project on Cadence!</h2>
      <p style="color: #5E6C84; font-size: 15px; line-height: 1.5;">
        Hi there,
      </p>
      <p style="color: #5E6C84; font-size: 15px; line-height: 1.5;">
        <strong style="color: #172B4D;">${inviterName}</strong> has invited you to collaborate on the project <strong style="color: #172B4D;">${projectName}</strong>.
      </p>
      <div style="margin: 32px 0;">
        <a href="${inviteLink}" style="background-color: #0052CC; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; font-size: 14px;">
          Accept Invitation
        </a>
      </div>
      <p style="color: #5E6C84; font-size: 13px; line-height: 1.5;">
        If you don't have an account yet, you'll be able to create one before joining the project.
      </p>
      <hr style="border: none; border-top: 1px solid #DFE1E6; margin: 24px 0;" />
      <p style="color: #7A869A; font-size: 12px; margin: 0;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: `You've been invited to ${projectName} on Cadence`,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend API Error details:", error);
      console.log(`\n========================================`);
      console.log(`[INVITATION LINK FOR TESTING]:`);
      console.log(`To: ${toEmail}`);
      console.log(`Link: ${inviteLink}`);
      console.log(`========================================\n`);

      if (error.statusCode === 403 || error.name === "validation_error") {
        console.warn(
          `[Resend Notice]: Resend free testing domain (onboarding@resend.dev) only sends emails to your registered Resend account email. To send emails to external recipients like ${toEmail}, verify a custom domain in the Resend dashboard and set RESEND_FROM_EMAIL in .env. You can use the printed link above to test invitation acceptance!`
        );
        return;
      }
      throw new Error(error.message || "Failed to send invitation email.");
    }

    console.log(`Invitation email sent successfully to ${toEmail} (Resend ID: ${data?.id})`);
  } catch (error: any) {
    console.error("Error sending invitation email:", error.message || error);
    console.log(`\n========================================`);
    console.log(`[FALLBACK INVITATION LINK]:`);
    console.log(`To: ${toEmail}`);
    console.log(`Link: ${inviteLink}`);
    console.log(`========================================\n`);
  }
};
