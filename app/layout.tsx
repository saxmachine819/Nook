import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/auth/AuthProvider"
import { ClientErrorBoundary } from "@/components/auth/ClientErrorBoundary"
import { TermsGate } from "@/components/auth/TermsGate"
import { Providers } from "@/app/providers"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Arial", "sans-serif"],
})

export const metadata: Metadata = {
  title: "Nooc - Reserve calm workspaces by the hour",
  description: "Reserve a seat by the hour in calm, professional public environments.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background`}>
        <ClientErrorBoundary>
          <Providers>
            <AuthProvider>
              <TermsGate>{children}</TermsGate>
            </AuthProvider>
          </Providers>
        </ClientErrorBoundary>
      </body>
    </html>
  )
}