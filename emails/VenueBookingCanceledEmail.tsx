import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"
import { emailStyles } from "./shared-styles"

export interface VenueBookingCanceledEmailProps {
  venueName?: string
  guestEmail?: string
  startAt?: string
  canceledAt?: string
}

const defaultProps: Required<VenueBookingCanceledEmailProps> = {
  venueName: "The Quiet Room",
  guestEmail: "guest@example.com",
  startAt: "2025-02-05T10:00:00Z",
  canceledAt: "2025-02-04T09:00:00Z",
}

export default function VenueBookingCanceledEmail(props: VenueBookingCanceledEmailProps) {
  const { venueName, guestEmail, startAt, canceledAt } = { ...defaultProps, ...props }
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
              A booking at <span style={s.highlight}>{displayVenueName}</span> has been canceled.
            </Text>
            <Text style={s.timeLine}>
              Guest: <span style={s.highlight}>{guestEmail}</span>
            </Text>
            <Text style={s.timeLine}>Was: {formatDate(startAt)}</Text>
            <Text style={s.timeLine}>Canceled at: {formatDate(canceledAt)}</Text>
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
