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

interface CadenceProjectCreatedEmailProps {
  ownerName?: string;
  projectName?: string;
  projectKey?: string;
  projectUrl?: string;
}

export const CadenceProjectCreatedEmail = ({
  ownerName = "Project Owner",
  projectName = "New Project",
  projectKey = "PROJ",
  projectUrl = "http://localhost:3000",
}: CadenceProjectCreatedEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>Your new project "{projectName}" [{projectKey}] has been created on Cadence!</Preview>
      <Container style={container}>
        <Section style={box}>
          <div style={brandBadge}>C</div>

          <Hr style={hr} />

          <Text style={heading}>🚀 Project Created: {projectName}</Text>

          <Text style={paragraph}>Hi {ownerName},</Text>

          <Text style={paragraph}>
            Congratulations! Your new project <strong style={boldText}>{projectName}</strong> with issue prefix <strong style={boldText}>[{projectKey}]</strong> is now live on Cadence.
          </Text>

          <Text style={paragraph}>
            You can start creating tasks, inviting team members, and interacting with your Cadence AI Copilot right away.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={projectUrl}>
              Open Project Board →
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Need assistance setting up your project workflow? Contact support at support@cadence.dev.
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

const boldText = {
  color: '#172B4D',
  fontWeight: 'bold' as const,
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

export default CadenceProjectCreatedEmail;
