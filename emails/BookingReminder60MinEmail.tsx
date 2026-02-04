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

export interface BookingReminder60MinEmailProps {
  venueName?: string
  startAt?: string
  endAt?: string
  seatLabel?: string | null
  tableLabel?: string | null
  viewBookingUrl?: string
}

const defaultProps: Required<BookingReminder60MinEmailProps> = {
  venueName: "The Quiet Room",
  startAt: "2025-02-05T10:00:00Z",
  endAt: "2025-02-05T12:00:00Z",
  seatLabel: null,
  tableLabel: null,
  viewBookingUrl: "https://nooc.io/venue",
}

export default function BookingReminder60MinEmail(props: BookingReminder60MinEmailProps) {
  const { venueName, startAt, endAt, seatLabel, tableLabel, viewBookingUrl } = { ...defaultProps, ...props }
  const displayVenueName = venueName?.trim() || defaultProps.venueName
  const resourceLabel = seatLabel?.trim() || tableLabel?.trim() || null
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
              Your booking at <span style={s.highlight}>{displayVenueName}</span>
              {resourceLabel ? ` (${resourceLabel})` : ""} starts in about 1 hour.
            </Text>
            <Text style={s.timeLine}>Start: {formatDate(startAt)}</Text>
            <Text style={s.timeLine}>End: {formatDate(endAt)}</Text>
            <Link href={viewBookingUrl} style={s.button}>
              View Booking
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
