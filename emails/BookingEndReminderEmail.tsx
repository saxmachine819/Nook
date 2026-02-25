import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"
import { formatDateTimeInTimezone } from "@/lib/email-date-utils"
import { EmailBrandHeader } from "./components/EmailBrandHeader"
import { emailStyles } from "./shared-styles"

export interface BookingEndReminderEmailProps {
  venueName?: string
  endAt?: string
  extendUrl?: string
  nextSlotAvailable?: boolean
  timeZone?: string
}

const defaultProps: Required<Omit<BookingEndReminderEmailProps, "timeZone">> = {
  venueName: "The Quiet Room",
  endAt: "2025-02-05T12:00:00Z",
  extendUrl: "https://nooc.io/venue",
  nextSlotAvailable: false,
}

export default function BookingEndReminderEmail(props: BookingEndReminderEmailProps) {
  const { venueName, endAt, extendUrl, nextSlotAvailable, timeZone } = { ...defaultProps, ...props }
  const displayVenueName = venueName?.trim() || defaultProps.venueName
  const ctaCopy = nextSlotAvailable ? "Tap to extend" : "If available, tap to extend"
  const s = emailStyles

  return (
    <Html>
      <Head />
      <Body style={s.main}>
        <Container style={s.container}>
          <EmailBrandHeader />
          <Section style={s.section}>
            <Text style={s.text}>
              Your booking at <span style={s.highlight}>{displayVenueName}</span> ends at:
            </Text>
            <Text style={s.timeLine}>{formatDateTimeInTimezone(endAt, timeZone)}</Text>
            <Text style={s.text}>{ctaCopy}</Text>
            <Link href={extendUrl} style={s.button}>
              {ctaCopy}
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
