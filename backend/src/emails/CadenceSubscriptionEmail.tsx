import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

export type SubscriptionEventType =
  | "NEW_SUBSCRIPTION"
  | "UPGRADE"
  | "DOWNGRADE"
  | "CANCELLATION"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED";

interface CadenceSubscriptionEmailProps {
  userName?: string;
  planName?: string;
  amountPaid?: string;
  billingPeriodEnd?: string;
  dashboardUrl?: string;
  eventType?: SubscriptionEventType;
  failureReason?: string;
}

export const CadenceSubscriptionEmail = ({
  userName = "Valued Member",
  planName = "PRO",
  amountPaid = "$19.00",
  billingPeriodEnd = "September 25, 2026",
  dashboardUrl = "http://localhost:3000/projects/billing",
  eventType = "NEW_SUBSCRIPTION",
  failureReason = "Payment processor rejected card charge.",
}: CadenceSubscriptionEmailProps) => {
  const isCancellation = eventType === "CANCELLATION";
  const isFailure = eventType === "PAYMENT_FAILED";

  const getPreviewText = () => {
    switch (eventType) {
      case "NEW_SUBSCRIPTION":
        return `Welcome to Cadence ${planName}! Your subscription is now active.`;
      case "UPGRADE":
        return `Your Cadence subscription has been upgraded to ${planName}.`;
      case "DOWNGRADE":
        return `Your Cadence subscription has been updated to ${planName}.`;
      case "CANCELLATION":
        return `Your Cadence ${planName} subscription has been canceled.`;
      case "PAYMENT_SUCCESS":
        return `Payment receipt for your Cadence ${planName} plan (${amountPaid}).`;
      case "PAYMENT_FAILED":
        return `Action required: Cadence payment failed (${amountPaid}).`;
      default:
        return `Cadence subscription update`;
    }
  };

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Preview>{getPreviewText()}</Preview>
        <Container style={container}>
          <Section style={box}>
            {/* Cadence Jira Brand Badge */}
            <div style={brandBadge}>C</div>

            <Hr style={hr} />

            {eventType === "NEW_SUBSCRIPTION" || eventType === "UPGRADE" ? (
              <>
                <Text style={heading}>🎉 Welcome to Cadence {planName}!</Text>
                <Text style={paragraph}>Hi {userName},</Text>
                <Text style={paragraph}>
                  Thanks for choosing <strong style={boldText}>Cadence {planName}</strong>. You're now ready to manage your team projects with full AI Copilot automation!
                </Text>
                <Text style={paragraph}>
                  Your payment of <strong style={boldText}>{amountPaid}</strong> was processed successfully. Your subscription is active through <strong style={boldText}>{billingPeriodEnd}</strong>.
                </Text>
                <Section style={buttonContainer}>
                  <Button style={button} href={dashboardUrl}>
                    View your Cadence Dashboard
                  </Button>
                </Section>
              </>
            ) : eventType === "PAYMENT_SUCCESS" ? (
              <>
                <Text style={heading}>🧾 Payment Receipt for Cadence {planName}</Text>
                <Text style={paragraph}>Hi {userName},</Text>
                <Text style={paragraph}>
                  This email confirms your payment of <strong style={boldText}>{amountPaid}</strong> for your <strong style={boldText}>{planName} Plan</strong>.
                </Text>
                <Text style={paragraph}>
                  Your subscription remains active through <strong style={boldText}>{billingPeriodEnd}</strong>.
                </Text>
                <Section style={buttonContainer}>
                  <Button style={button} href={dashboardUrl}>
                    View Billing & Invoices
                  </Button>
                </Section>
              </>
            ) : eventType === "CANCELLATION" ? (
              <>
                <Text style={headingAlert}>⚠️ Subscription Canceled</Text>
                <Text style={paragraph}>Hi {userName},</Text>
                <Text style={paragraph}>
                  Your subscription to <strong style={boldText}>Cadence {planName}</strong> has been canceled. Your account has been reverted to the Free Plan.
                </Text>
                <Text style={paragraph}>
                  If this was done by mistake, you can reactivate your subscription anytime right from your billing dashboard.
                </Text>
                <Section style={buttonContainer}>
                  <Button style={buttonAlert} href={dashboardUrl}>
                    Reactivate Subscription
                  </Button>
                </Section>
              </>
            ) : eventType === "PAYMENT_FAILED" ? (
              <>
                <Text style={headingAlert}>❌ Payment Failed for Cadence {planName}</Text>
                <Text style={paragraph}>Hi {userName},</Text>
                <Text style={paragraph}>
                  We were unable to process your payment of <strong style={boldText}>{amountPaid}</strong> for your <strong style={boldText}>{planName} Plan</strong>.
                </Text>
                <div style={errorBox}>
                  <strong>Reason:</strong> {failureReason}
                </div>
                <Text style={paragraph}>
                  Please update your payment details to maintain uninterrupted access to your projects and AI features.
                </Text>
                <Section style={buttonContainer}>
                  <Button style={buttonAlert} href={dashboardUrl}>
                    Update Payment Method
                  </Button>
                </Section>
              </>
            ) : (
              <>
                <Text style={heading}>ℹ️ Subscription Updated to Cadence {planName}</Text>
                <Text style={paragraph}>Hi {userName},</Text>
                <Text style={paragraph}>
                  Your subscription has been updated to the <strong style={boldText}>{planName} Plan</strong>. Your new plan features are now active.
                </Text>
                <Section style={buttonContainer}>
                  <Button style={button} href={dashboardUrl}>
                    Manage Plan
                  </Button>
                </Section>
              </>
            )}

            <Hr style={hr} />
            <Text style={paragraph}>
              We'll be here to help you with any step along the way. If you have questions about your account, you can reach out to our team at{' '}
              <Link style={anchor} href="mailto:support@cadence.dev">
                support site
              </Link>.
            </Text>
            <Text style={paragraph}>— The Cadence Team</Text>
            <Hr style={hr} />
            <Text style={footer}>
              Cadence Inc. — Modern Agile & Project Management Platform
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default CadenceSubscriptionEmail;

// ── Inlined React Email Styles (Matching Stripe Template + Atlassian Jira Colors) ──

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  padding: '10px 0',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  borderRadius: '8px',
  border: '1px solid #e6ebf1',
  maxWidth: '560px',
};

const box = {
  padding: '0 48px',
};

const brandBadge = {
  width: '42px',
  height: '42px',
  borderRadius: '8px',
  backgroundColor: '#0052CC',
  color: '#ffffff',
  fontWeight: 'bold' as const,
  fontSize: '22px',
  lineHeight: '42px',
  textAlign: 'center' as const,
  margin: '12px 0 8px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const heading = {
  color: '#172B4D',
  fontSize: '22px',
  fontWeight: 'bold' as const,
  lineHeight: '30px',
  margin: '16px 0 8px',
};

const headingAlert = {
  color: '#DE350B',
  fontSize: '22px',
  fontWeight: 'bold' as const,
  lineHeight: '30px',
  margin: '16px 0 8px',
};

const paragraph = {
  color: '#525f7f',
  fontSize: '15px',
  lineHeight: '24px',
  textAlign: 'left' as const,
  margin: '12px 0',
};

const boldText = {
  color: '#172B4D',
  fontWeight: 'bold' as const,
};

const anchor = {
  color: '#0052CC',
  textDecoration: 'underline',
};

const buttonContainer = {
  margin: '24px 0',
};

const button = {
  backgroundColor: '#0052CC',
  borderRadius: '5px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '100%',
  padding: '12px 18px',
  boxSizing: 'border-box' as const,
};

const buttonAlert = {
  backgroundColor: '#DE350B',
  borderRadius: '5px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '100%',
  padding: '12px 18px',
  boxSizing: 'border-box' as const,
};

const errorBox = {
  backgroundColor: '#FFEBE6',
  border: '1px solid #FFBDAD',
  borderRadius: '5px',
  color: '#DE350B',
  padding: '12px',
  fontSize: '14px',
  margin: '16px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
};
