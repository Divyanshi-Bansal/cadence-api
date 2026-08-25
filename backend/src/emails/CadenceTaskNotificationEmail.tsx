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

export type TaskActionType =
  | "ASSIGNED"
  | "STAGE_CHANGED"
  | "PRIORITY_CHANGED"
  | "COMMENT_ADDED"
  | "COPILOT_UPDATED";

interface CadenceTaskNotificationEmailProps {
  recipientName?: string;
  actorName?: string;
  taskKey?: string;
  taskTitle?: string;
  actionType?: TaskActionType;
  oldValue?: string;
  newValue?: string;
  commentBody?: string;
  taskUrl?: string;
}

export const CadenceTaskNotificationEmail = ({
  recipientName = "Team Member",
  actorName = "Cadence User",
  taskKey = "CAD-101",
  taskTitle = "Update User Dashboard Component",
  actionType = "ASSIGNED",
  oldValue = "Backlog",
  newValue = "In Progress",
  commentBody,
  taskUrl = "http://localhost:3000",
}: CadenceTaskNotificationEmailProps) => {
  const getSubject = () => `📋 Task Update: [${taskKey}] ${taskTitle}`;

  const renderBadge = () => {
    switch (actionType) {
      case "ASSIGNED":
        return <span style={badgeBlue}>👤 Assigned to You</span>;
      case "STAGE_CHANGED":
        return <span style={badgeGreen}>🔄 Stage Updated</span>;
      case "PRIORITY_CHANGED":
        return <span style={badgeAmber}>⚠️ Priority Changed</span>;
      case "COMMENT_ADDED":
        return <span style={badgePurple}>💬 New Comment</span>;
      case "COPILOT_UPDATED":
        return <span style={badgeNavy}>🤖 Cadence AI Copilot Update</span>;
    }
  };

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Preview>{getSubject()}</Preview>
        <Container style={container}>
          <Section style={box}>
            <div style={brandBadge}>C</div>

            <Hr style={hr} />

            <Text style={heading}>📋 Task Update: [{taskKey}]</Text>

            <div style={badgeWrapper}>{renderBadge()}</div>

            <Text style={paragraph}>Hi {recipientName},</Text>

            <Text style={paragraph}>
              <strong style={boldText}>{actorName}</strong> made changes to task <strong style={boldText}>[{taskKey}] {taskTitle}</strong>:
            </Text>

            {actionType === "ASSIGNED" && (
              <div style={diffBox}>
                Task assigned to <strong style={boldText}>{recipientName}</strong>
              </div>
            )}

            {actionType === "STAGE_CHANGED" && (
              <div style={diffBox}>
                Stage changed from <span>{oldValue}</span> ➔ <strong style={boldText}>{newValue}</strong>
              </div>
            )}

            {actionType === "PRIORITY_CHANGED" && (
              <div style={diffBox}>
                Priority escalated from <span>{oldValue}</span> ➔ <strong style={boldText}>{newValue}</strong>
              </div>
            )}

            {actionType === "COMMENT_ADDED" && commentBody && (
              <div style={commentBox}>
                <em>"{commentBody}"</em>
              </div>
            )}

            {actionType === "COPILOT_UPDATED" && (
              <div style={diffBox}>
                AI Copilot executed: <strong style={boldText}>{newValue}</strong>
              </div>
            )}

            <Section style={buttonContainer}>
              <Button style={button} href={taskUrl}>
                View Task Details →
              </Button>
            </Section>

            <Hr style={hr} />

            <Text style={footer}>
              You are receiving this notification because you are assigned to or watching task {taskKey}.
            </Text>
            <Text style={footer}>
              Cadence Inc. — Modern Agile & Project Management Platform
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

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

const badgeWrapper = {
  margin: '12px 0 16px',
};

const badgeBlue = {
  backgroundColor: '#DEEBFF',
  color: '#0052CC',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 'bold' as const,
};

const badgeGreen = {
  backgroundColor: '#E3FCEF',
  color: '#006644',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 'bold' as const,
};

const badgeAmber = {
  backgroundColor: '#FFF0B3',
  color: '#172B4D',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 'bold' as const,
};

const badgePurple = {
  backgroundColor: '#EAE6FF',
  color: '#403294',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 'bold' as const,
};

const badgeNavy = {
  backgroundColor: '#DEEBFF',
  color: '#0747A6',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 'bold' as const,
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

const diffBox = {
  backgroundColor: '#F4F5F7',
  border: '1px solid #DFE1E6',
  borderRadius: '6px',
  padding: '12px 16px',
  fontSize: '14px',
  color: '#172B4D',
  margin: '16px 0',
};

const commentBox = {
  backgroundColor: '#F4F5F7',
  borderLeft: '4px solid #0052CC',
  padding: '12px 16px',
  fontSize: '14px',
  color: '#172B4D',
  margin: '16px 0',
  borderRadius: '0 6px 6px 0',
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

export default CadenceTaskNotificationEmail;
