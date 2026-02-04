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
} from "@react-email/components"
import * as React from "react"
import { emailStyles } from "./shared-styles"

export interface VenueBookingCreatedEmailProps {
  venueName?: string
  guestEmail?: string
  startAt?: string
  endAt?: string
}

const defaultProps: Required<VenueBookingCreatedEmailProps> = {
  venueName: "The Quiet Room",
  guestEmail: "guest@example.com",
  startAt: "2025-02-05T10:00:00Z",
  endAt: "2025-02-05T12:00:00Z",
}

export default function VenueBookingCreatedEmail(props: VenueBookingCreatedEmailProps) {
  const { venueName, guestEmail, startAt, endAt } = { ...defaultProps, ...props }
  const displayVenueName = venueName?.trim() || defaultProps.venueName
  const s = emailStyles

  return (
    <Html>
      <Head />
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.brand}>Nooc</Heading>
          </Section>
          <Section style={s.section}>
            <Text style={s.text}>
              New booking at <span style={s.highlight}>{displayVenueName}</span>.
            </Text>
            <Text style={s.timeLine}>
              Guest: <span style={s.highlight}>{guestEmail}</span>
            </Text>
            <Text style={s.timeLine}>Start: {formatDate(startAt)}</Text>
            <Text style={s.timeLine}>End: {formatDate(endAt)}</Text>
            <Link href="https://nooc.io/venue/dashboard" style={s.button}>
              View dashboard
            </Link>
          </Section>
          <Hr style={s.hr} />
          <Section style={s.footer}>
            <Text style={s.footerText}>Questions? Reply to support@nooc.io</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
