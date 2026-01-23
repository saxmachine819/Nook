import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/auth/AuthProvider"
import { ClientErrorBoundary } from "@/components/auth/ClientErrorBoundary"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Nook - Reserve calm workspaces by the hour",
  description: "Reserve a seat by the hour in calm, professional public environments.",
}

/** Bypass SessionProvider when 1|true, or when unset (default) to avoid white screen. Set to 0|false once auth is fixed to use Profile/sign-in. */
const skipAuth =
  process.env.NEXT_PUBLIC_SKIP_AUTH === "0" ||
  process.env.NEXT_PUBLIC_SKIP_AUTH === "false"
    ? false
    : true

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ClientErrorBoundary>
          {skipAuth ? children : <AuthProvider>{children}</AuthProvider>}
        </ClientErrorBoundary>
      </body>
    </html>
  )
}