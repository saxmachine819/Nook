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

export interface BookingConfirmationEmailProps {
  venueName?: string
  startAt?: string
  endAt?: string
  confirmationUrl?: string
}

const defaultProps: Required<BookingConfirmationEmailProps> = {
  venueName: "The Quiet Room",
  startAt: "2025-02-05T10:00:00Z",
  endAt: "2025-02-05T12:00:00Z",
  confirmationUrl: "https://nooc.io/reservations",
}

export default function BookingConfirmationEmail(props: BookingConfirmationEmailProps) {
  const { venueName, startAt, endAt, confirmationUrl } = { ...defaultProps, ...props }
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
              Your booking at <span style={s.highlight}>{displayVenueName}</span> is confirmed.
            </Text>
            <Text style={s.timeLine}>Start: {formatDate(startAt)}</Text>
            <Text style={s.timeLine}>End: {formatDate(endAt)}</Text>
            <Link href={confirmationUrl} style={s.button}>
              View reservation
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
