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

export interface AdminVenueSubmissionEmailProps {
  venueName?: string
  approvalsUrl?: string
}

const defaultProps: Required<AdminVenueSubmissionEmailProps> = {
  venueName: "A new venue",
  approvalsUrl: "https://nooc.io/admin/approvals",
}

export default function AdminVenueSubmissionEmail(props: AdminVenueSubmissionEmailProps) {
  const { venueName, approvalsUrl } = { ...defaultProps, ...props }
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
              New venue approval request
            </Heading>
            <Text style={s.text}>
              <span style={s.highlight}>{displayVenueName}</span> has been submitted for approval
              and is waiting in the admin queue.
            </Text>
            <Link href={approvalsUrl} style={s.button}>
              View pending approvals
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
