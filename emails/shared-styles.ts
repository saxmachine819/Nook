/**
 * Shared email styles aligned with Nooc design system.
 * Calm, minimal, warm; dark green primary; warm neutrals.
 */
import * as React from "react"

export const emailStyles = {
  main: {
    backgroundColor: "#f5f5f0",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  } as React.CSSProperties,

  container: {
    margin: "0 auto",
    padding: "24px",
    maxWidth: "560px",
    borderRadius: "12px",
  } as React.CSSProperties,

  header: {
    paddingBottom: "16px",
  } as React.CSSProperties,

  brand: {
    margin: "0",
    fontSize: "24px",
    fontWeight: "600",
    color: "#0F5132",
    letterSpacing: "-0.02em",
  } as React.CSSProperties,

  section: {
    padding: "8px 0",
  } as React.CSSProperties,

  text: {
    margin: "0 0 24px",
    fontSize: "16px",
    lineHeight: "1.6",
    color: "#374151",
  } as React.CSSProperties,

  /** Venue name and user/guest name emphasis */
  highlight: {
    color: "#0F5132",
    fontWeight: "600",
  } as React.CSSProperties,

  /** Time lines (Start / End / Was / Canceled at) */
  timeLine: {
    margin: "0 0 4px",
    fontSize: "16px",
    lineHeight: "1.6",
    color: "#6b7280",
  } as React.CSSProperties,

  button: {
    backgroundColor: "#0F5132",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "600",
    padding: "12px 24px",
    borderRadius: "8px",
    textDecoration: "none",
    display: "inline-block",
  } as React.CSSProperties,

  hr: {
    borderColor: "#e5e5e0",
    margin: "24px 0",
  } as React.CSSProperties,

  footer: {
    paddingTop: "8px",
  } as React.CSSProperties,

  footerText: {
    margin: "0",
    fontSize: "13px",
    color: "#6b7280",
  } as React.CSSProperties,
}
