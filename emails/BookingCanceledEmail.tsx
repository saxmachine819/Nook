import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"
import { formatDateTimeInTimezone } from "@/lib/email-date-utils"
import { EmailBrandHeader } from "./components/EmailBrandHeader"
import { emailStyles } from "./shared-styles"

export interface BookingCanceledEmailProps {
  venueName?: string
  startAt?: string
  canceledAt?: string
  timeZone?: string
}

const defaultProps: Required<Omit<BookingCanceledEmailProps, "timeZone">> = {
  venueName: "The Quiet Room",
  startAt: "2025-02-05T10:00:00Z",
  canceledAt: "2025-02-04T09:00:00Z",
}

export default function BookingCanceledEmail(props: BookingCanceledEmailProps) {
  const { venueName, startAt, canceledAt, timeZone } = { ...defaultProps, ...props }
  const displayVenueName = venueName?.trim() || defaultProps.venueName
  const s = emailStyles

  return (
    <Html>
      <Head />
      <Body style={s.main}>
        <Container style={s.container}>
          <EmailBrandHeader />
          <Section style={s.section}>
            <Text style={s.text}>
              Your booking at <span style={s.highlight}>{displayVenueName}</span> has been canceled.
            </Text>
            <Text style={s.timeLine}>Was: {formatDateTimeInTimezone(startAt, timeZone)}</Text>
            <Text style={s.timeLine}>Canceled at: {formatDateTimeInTimezone(canceledAt, timeZone)}</Text>
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
