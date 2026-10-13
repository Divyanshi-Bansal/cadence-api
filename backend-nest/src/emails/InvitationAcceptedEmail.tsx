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

interface InvitationAcceptedEmailProps {
  userName?: string;
  projectName?: string;
  role?: string;
  projectLink?: string;
}

export const InvitationAcceptedEmail = ({
  userName = "there",
  projectName = "Cadence Project",
  role = "MEMBER",
  projectLink = "http://localhost:3000",
}: InvitationAcceptedEmailProps) => (
  <Tailwind>
    <Html>
      <Head />
      <Body className="bg-white font-sans">
        <Preview>You have joined {projectName} on Cadence</Preview>
        <Container className="mx-auto my-0 pt-6 px-[28px] pb-12 bg-white max-w-[580px] border border-[#DFE1E6] rounded-lg shadow-sm">
          <div className="w-10 h-10 rounded-md bg-[#0052CC] text-white font-bold text-xl leading-[40px] text-center mb-6">
            C
          </div>
          <Heading className="text-[24px] font-bold text-[#172B4D] mt-2 mb-4 tracking-tight">
            🎉 Welcome to {projectName}!
          </Heading>
          <Section className="my-6">
            <Text className="text-sm leading-6 text-[#172B4D]">
              Hi {userName},
            </Text>
            <Text className="text-sm leading-6 text-[#5E6C84] mt-2">
              You have successfully accepted the invitation and joined the project <strong className="text-[#172B4D]">{projectName}</strong> as a <strong className="text-[#172B4D]">{role}</strong>.
            </Text>
            <div className="my-8">
              <Link
                className="bg-[#0052CC] hover:bg-[#0747A6] text-white font-semibold text-xs px-6 py-3 rounded-[3px] inline-block no-underline shadow-sm"
                href={projectLink}
              >
                Open Project Workspace →
              </Link>
            </div>
            <Text className="text-xs leading-5 text-[#5E6C84]">
              You can now collaborate with your team, view sprint boards, and manage tasks within this project.
            </Text>
          </Section>

          <Hr className="border-[#DFE1E6] my-6" />

          <Text className="text-[#8898aa] text-[11px] leading-4">
            If you did not accept this invitation or believe this is an error, please contact your workspace administrator.
          </Text>
          <Text className="text-[#8898aa] text-[11px] leading-4 mt-1">
            Cadence Inc. — Modern Agile & Project Management Platform
          </Text>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);

InvitationAcceptedEmail.PreviewProps = {
  userName: "Anshul",
  projectName: "Marketing Website Redesign",
  role: "MEMBER",
  projectLink: "http://localhost:3000/projects/sample_project_id",
} as InvitationAcceptedEmailProps;

export default InvitationAcceptedEmail;
