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

export interface BookingCanceledEmailProps {
  venueName?: string
  startAt?: string
  canceledAt?: string
}

const defaultProps: Required<BookingCanceledEmailProps> = {
  venueName: "The Quiet Room",
  startAt: "2025-02-05T10:00:00Z",
  canceledAt: "2025-02-04T09:00:00Z",
}

export default function BookingCanceledEmail(props: BookingCanceledEmailProps) {
  const { venueName, startAt, canceledAt } = { ...defaultProps, ...props }
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
              Your booking at <span style={s.highlight}>{displayVenueName}</span> has been canceled.
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
