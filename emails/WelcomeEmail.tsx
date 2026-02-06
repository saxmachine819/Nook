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

export interface WelcomeEmailProps {
  userName?: string
  ctaUrl?: string
}

const defaultProps: Required<WelcomeEmailProps> = {
  userName: "Alex",
  ctaUrl: "https://nooc.io",
}

export default function WelcomeEmail(props: WelcomeEmailProps) {
  const { userName, ctaUrl } = { ...defaultProps, ...props }
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
              Hi <span style={s.highlight}>{userName}</span>, welcome to Nooc. Reserve a seat by the
              hour in your favorite places.
            </Text>
            <Link href={ctaUrl} style={s.button}>
              Explore venues
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
