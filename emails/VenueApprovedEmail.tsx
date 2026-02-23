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
import { EmailBrandHeader } from "./components/EmailBrandHeader"
import { emailStyles } from "./shared-styles"

export interface VenueApprovedEmailProps {
  venueName?: string
  dashboardUrl?: string
}

const defaultProps: Required<VenueApprovedEmailProps> = {
  venueName: "Bluebird Café",
  dashboardUrl: "https://nooc.io/venue/dashboard",
}

export default function VenueApprovedEmail(props: VenueApprovedEmailProps) {
  const { venueName, dashboardUrl } = { ...defaultProps, ...props }
  const displayVenueName = venueName?.trim() || defaultProps.venueName
  const s = emailStyles

  return (
    <Html>
      <Head />
      <Body style={s.main}>
        <Container style={s.container}>
          <EmailBrandHeader />
          <Section style={s.section}>
            <Heading as="h2" style={{ ...s.text, marginTop: 0, fontSize: "20px" }}>
              {displayVenueName} is approved!
            </Heading>
            <Text style={s.text}>
              Great news — <span style={s.highlight}>{displayVenueName}</span> has been approved and
              is now ready to start accepting reservations on Nooc.
            </Text>
            <Text style={s.text}>As you get started, here are a few best practices we've seen work well:</Text>
            <Text style={s.timeLine}>• Present your Nooc QR code at the front register so guests know reservations are available</Text>
            <Text style={s.timeLine}>• Use table tent QR codes to make booking easy from any seat</Text>
            <Text style={s.timeLine}>• Train your staff on how Nooc works so they can answer quick questions</Text>
            <Text style={s.timeLine}>
              • For now, Nooc works best as a way for your existing customers to reserve seats — as Nooc's user base grows, we're excited for new people to discover{" "}
              <span style={s.highlight}>{displayVenueName}</span> through the Explore feature
            </Text>
            <Text style={s.text}>
              You can find all of <span style={s.highlight}>{displayVenueName}'s</span> QR codes in the{" "}
              <strong>Manage Dashboard → QR Code Management</strong>. You're free to print them yourself, or order professionally printed QR materials directly through Nooc.
            </Text>
            <Text style={s.text}>
              You can manage bookings, availability, QR codes, and payouts for{" "}
              <span style={s.highlight}>{displayVenueName}</span> anytime from your dashboard.
            </Text>
            <Link href={dashboardUrl} style={s.button}>
              Go to your dashboard
            </Link>
          </Section>
          <Hr style={s.hr} />
          <Section style={s.footer}>
            <Text style={s.footerText}>Questions? Reach us at support@nooc.io</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
