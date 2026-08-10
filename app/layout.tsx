import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ClientErrorBoundary } from "@/components/auth/ClientErrorBoundary";
import { TermsGate } from "@/components/auth/TermsGate";
import { Providers } from "@/app/providers";
import { NativeAppBootstrap } from "@/components/native/NativeAppBootstrap";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  fallback: [
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "Arial",
    "sans-serif",
  ],
});

export const metadata: Metadata = {
  title: "Nooc - Reserve calm workspaces by the hour",
  description:
    "Reserve a seat by the hour in calm, professional public environments.",
};

// viewport-fit=cover is required for env(safe-area-inset-*) to resolve to
// anything other than 0 — without it, the native shell's notch/home-indicator
// spacing (bottom nav, full-bleed map, etc.) silently has no effect at all.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background`}>
        <ClientErrorBoundary>
          <Providers>
            <AuthProvider session={session}>
              <NativeAppBootstrap />
              <TermsGate>{children}</TermsGate>
            </AuthProvider>
          </Providers>
        </ClientErrorBoundary>
      </body>
    </html>
  );
}
