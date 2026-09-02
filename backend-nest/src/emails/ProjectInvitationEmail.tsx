import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import React from "react";

interface ProjectInvitationEmailProps {
  inviterName?: string;
  projectName?: string;
  inviteLink?: string;
}

export const ProjectInvitationEmail = ({
  inviterName = "A team member",
  projectName = "Cadence Project",
  inviteLink = "http://localhost:3000",
}: ProjectInvitationEmailProps) => (
  <Tailwind>
    <Html>
      <Head />
      <Body className="bg-white font-sans">
        <Preview>You've been invited to join {projectName} on Cadence</Preview>
        <Container className="mx-auto my-0 pt-6 px-[28px] pb-12 bg-white max-w-[580px] border border-[#DFE1E6] rounded-lg shadow-sm">
          <div className="w-10 h-10 rounded-md bg-[#0052CC] text-white font-bold text-xl leading-[40px] text-center mb-6">
            C
          </div>
          <Heading className="text-[24px] font-bold text-[#172B4D] mt-2 mb-4 tracking-tight">
            🎉 You've been invited to join {projectName}!
          </Heading>
          <Section className="my-6">
            <Text className="text-sm leading-6 text-[#172B4D]">
              Hi there,
            </Text>
            <Text className="text-sm leading-6 text-[#5E6C84] mt-2">
              <strong className="text-[#172B4D]">{inviterName}</strong> has invited you to collaborate on the project <strong className="text-[#172B4D]">{projectName}</strong> in Cadence.
            </Text>
            <div className="my-8">
              <Link
                className="bg-[#0052CC] hover:bg-[#0747A6] text-white font-semibold text-xs px-6 py-3 rounded-[3px] inline-block no-underline shadow-sm"
                href={inviteLink}
              >
                Accept Invitation & Join Project →
              </Link>
            </div>
            <Text className="text-xs leading-5 text-[#5E6C84]">
              If you don't have a Cadence account yet, you'll be able to create one before accepting the invitation.
            </Text>
          </Section>

          <Hr className="border-[#DFE1E6] my-6" />

          <Text className="text-[#8898aa] text-[11px] leading-4">
            If you didn't expect this invitation, you can safely ignore this email.
          </Text>
          <Text className="text-[#8898aa] text-[11px] leading-4 mt-1">
            Cadence Inc. — Modern Agile & Project Management Platform
          </Text>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);

ProjectInvitationEmail.PreviewProps = {
  inviterName: "Anshul Vats",
  projectName: "Project 1",
  inviteLink: "http://localhost:3000/invite/accept?token=sample_token",
} as ProjectInvitationEmailProps;

export default ProjectInvitationEmail;
