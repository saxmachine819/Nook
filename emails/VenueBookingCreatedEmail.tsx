import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface VenueBookingCreatedEmailProps {
  venueName?: string;
  guestEmail?: string;
  startAt?: string;
  endAt?: string;
}

const defaultProps: Required<VenueBookingCreatedEmailProps> = {
  venueName: "The Quiet Room",
  guestEmail: "guest@example.com",
  startAt: "2025-02-05T10:00:00Z",
  endAt: "2025-02-05T12:00:00Z",
};

export default function VenueBookingCreatedEmail(props: VenueBookingCreatedEmailProps) {
  const { venueName, guestEmail, startAt, endAt } = { ...defaultProps, ...props };

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={brand}>Nooc</Heading>
          </Section>
          <Section style={section}>
            <Text style={text}>
              New booking at {venueName}. Guest: {guestEmail}. Start: {formatDate(startAt)}, End: {formatDate(endAt)}.
            </Text>
            <Link href="https://nooc.io/venue/dashboard" style={button}>
              View dashboard
            </Link>
          </Section>
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>Questions? Reply to support@nooc.io</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const main = {
  backgroundColor: "#f5f5f0",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
};

const container = { margin: "0 auto", padding: "24px", maxWidth: "560px" };
const header = { paddingBottom: "16px" };
const brand = { margin: "0", fontSize: "24px", fontWeight: "600", color: "#0F5132", letterSpacing: "-0.02em" };
const section = { padding: "8px 0" };
const text = { margin: "0 0 24px", fontSize: "16px", lineHeight: "1.6", color: "#374151" };
const button = {
  backgroundColor: "#0F5132",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  padding: "12px 24px",
  borderRadius: "8px",
  textDecoration: "none",
  display: "inline-block",
};
const hr = { borderColor: "#e5e5e0", margin: "24px 0" };
const footer = { paddingTop: "8px" };
const footerText = { margin: "0", fontSize: "13px", color: "#6b7280" };
