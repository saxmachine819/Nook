import { Heading, Img, Section } from "@react-email/components"
import * as React from "react"
import { emailStyles } from "../shared-styles"

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://nooc.io").replace(/\/$/, "")
const logoSrc = `${baseUrl}/email-logo.png`

export function EmailBrandHeader() {
  const s = emailStyles
  return (
    <Section style={s.header}>
      <div style={s.brandRow}>
        <Img src={logoSrc} alt="Nooc" width={28} height={28} style={s.logo} />
        <Heading style={s.brand}>Nooc</Heading>
      </div>
    </Section>
  )
}
