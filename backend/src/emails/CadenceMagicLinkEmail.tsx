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

interface CadenceMagicLinkEmailProps {
  userEmail?: string;
  magicLink?: string;
}

export const CadenceMagicLinkEmail = ({
  userEmail = "member@example.com",
  magicLink = "http://localhost:3000",
}: CadenceMagicLinkEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>Log in to your Cadence workspace with this magic link.</Preview>
      <Container style={container}>
        <Section style={box}>
          <div style={brandBadge}>C</div>

          <Hr style={hr} />

          <Text style={heading}>🪄 Log in to Cadence</Text>

          <Text style={paragraph}>Hi {userEmail},</Text>

          <Text style={paragraph}>
            Click the button below to instantly sign in to your Cadence workspace without entering a password.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={magicLink}>
              Log In to Cadence →
            </Button>
          </Section>

          <Text style={paragraph}>
            Or copy and paste this URL into your browser:
          </Text>
          <Text style={urlText}>
            <Link style={anchor} href={magicLink}>
              {magicLink}
            </Link>
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            This link will expire shortly for your security. If you didn't request a magic link, you can safely ignore this email.
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

export default CadenceMagicLinkEmail;
