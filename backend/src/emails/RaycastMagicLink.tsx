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

interface RaycastMagicLinkEmailProps {
  magicLink?: string;
  userEmail?: string;
}

export const RaycastMagicLinkEmail = ({
  magicLink = "http://localhost:3000",
}: RaycastMagicLinkEmailProps) => (
  <Html>
    <Head />
    <Tailwind>
      <Body className="bg-white font-sans">
        <Preview>Log in with this magic link.</Preview>
        <Container className="mx-auto my-0 pt-5 px-[25px] pb-12 bg-white">
          <div className="w-12 h-12 rounded-lg bg-[#0052CC] text-white font-bold text-2xl leading-[48px] text-center mb-6">
            C
          </div>
          <Heading className="text-[28px] font-bold mt-6 text-[#172B4D]">
            🪄 Your magic link
          </Heading>
          <Section className="my-6 mx-0">
            <Text className="text-base leading-6 text-[#5E6C84]">
              <Link className="text-[#0052CC] font-bold underline" href={magicLink}>
                👉 Click here to sign in 👈
              </Link>
            </Text>
            <Text className="text-base leading-6 text-[#5E6C84]">
              If you didn't request this, please ignore this email.
            </Text>
          </Section>
          <Text className="text-base leading-6 text-[#5E6C84]">
            Best,
            <br />- Cadence Team
          </Text>
          <Hr className="border-[#DFE1E6] mt-12" />
          <Text className="text-[#8898aa] text-xs leading-6">
            Cadence Inc. — Project Management Platform
          </Text>
          <Text className="text-[#8898aa] text-xs leading-6">
            Building the future of team collaboration
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

RaycastMagicLinkEmail.PreviewProps = {
  magicLink: "http://localhost:3000/auth/verify-magic-link?token=sample_token",
} as RaycastMagicLinkEmailProps;

export default RaycastMagicLinkEmail;
