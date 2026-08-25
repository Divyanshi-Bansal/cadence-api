import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

interface CadencePasswordResetEmailProps {
  userName?: string;
  resetLink?: string;
}

export const CadencePasswordResetEmail = ({
  userName = "Valued Member",
  resetLink = "http://localhost:3000/auth/reset-password",
}: CadencePasswordResetEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>Reset your Cadence account password.</Preview>
      <Container style={container}>
        <Section style={box}>
          <div style={brandBadge}>C</div>

          <Hr style={hr} />

          <Text style={heading}>🔑 Reset Your Password</Text>

          <Text style={paragraph}>Hi {userName},</Text>

          <Text style={paragraph}>
            We received a request to reset the password for your Cadence account. Click the button below to choose a new password.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={resetLink}>
              Reset Your Password →
            </Button>
          </Section>

          <Text style={paragraph}>
            Or copy and paste this link into your browser:
          </Text>
          <Text style={urlText}>
            <Link style={anchor} href={resetLink}>
              {resetLink}
            </Link>
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            This password reset link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
          </Text>
          <Text style={footer}>
            Cadence Inc. — Modern Agile & Project Management Platform
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

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

const paragraph = {
  color: '#525f7f',
  fontSize: '15px',
  lineHeight: '24px',
  textAlign: 'left' as const,
  margin: '12px 0',
};

const urlText = {
  color: '#0052CC',
  fontSize: '13px',
  wordBreak: 'break-all' as const,
  margin: '8px 0 16px',
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

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
};

export default CadencePasswordResetEmail;
