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

export interface CustomerFollowUpEmailProps {
  venueName?: string
  rebookUrl?: string
  exploreUrl?: string
}

const defaultProps: Required<CustomerFollowUpEmailProps> = {
  venueName: "The Quiet Room",
  rebookUrl: "https://nooc.io/venue/example",
  exploreUrl: "https://nooc.io",
}

export default function CustomerFollowUpEmail(props: CustomerFollowUpEmailProps) {
  const { venueName, rebookUrl, exploreUrl } = { ...defaultProps, ...props }
  const displayVenueName = venueName?.trim() || defaultProps.venueName
  const s = emailStyles

  return (
    <Html>
      <Head />
      <Body style={s.main}>
        <Container style={s.container}>
          <EmailBrandHeader />
          <Section style={s.section}>
            <Heading as="h2" style={{ ...s.text, marginTop: 0, fontSize: "18px", fontWeight: "600" }}>
              Thanks for using Nooc today
            </Heading>
            <Text style={s.text}>
              Thanks so much for reserving a spot with Nooc, we hope you had a great experience.
            </Text>
            <Text style={s.text}>
              Whether you were heads-down getting work done or just enjoyed having a guaranteed seat,
              we're glad Nooc could help.
            </Text>
            <Text style={s.text}>
              If you'd like to book again, you can easily reserve another spot at{" "}
              <span style={s.highlight}>{displayVenueName}</span>, or explore other participating
              venues nearby.
            </Text>
            <Text style={s.text}>
              Nooc is still growing, and right now it works best as a way for regular customers to
              reserve seats at places they already love. Over time, we're excited for more people to
              discover great spaces through Nooc — and for venues like{" "}
              <span style={s.highlight}>{displayVenueName}</span> to benefit.
            </Text>
            <Text style={s.text}>
              Thanks again for being an early part of this. We're excited to keep building.
            </Text>
            <Link href={rebookUrl} style={s.button}>
              Rebook a seat
            </Link>
            <Text style={{ ...s.text, marginTop: "16px", marginBottom: "8px" }}>
              <Link href={exploreUrl} style={{ ...s.highlight, textDecoration: "underline" }}>
                Explore nearby venues
              </Link>
            </Text>
          </Section>
          <Hr style={s.hr} />
          <Section style={s.footer}>
            <Text style={s.footerText}>
              Questions or feedback? Reach us at support@nooc.io
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
