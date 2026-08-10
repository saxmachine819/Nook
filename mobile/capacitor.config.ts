import type { CapacitorConfig } from "@capacitor/cli"

const APP_URL =
  process.env.MOBILE_SERVER_URL ||
  process.env.NEXT_PUBLIC_MOBILE_APP_URL ||
  "https://nooc.io"

const config: CapacitorConfig = {
  appId: "io.nooc.app",
  appName: "Nooc",
  webDir: "www",
  // Matches --background (HSL 30 20% 98%) so the native WebView's own
  // background doesn't show through as a white seam under the status bar
  // before content paints or around fixed-position full-bleed content.
  backgroundColor: "#FAF8F5",
  server: {
    // Shared product UI: load the live Next.js site so web + app stay one codebase.
    // Local www/ is used for splash/offline fallback and shell preview.
    url: APP_URL,
    cleartext: false,
    allowNavigation: [
      "nooc.io",
      "*.nooc.io",
      "accounts.google.com",
      "appleid.apple.com",
      "*.stripe.com",
      "js.stripe.com",
      "hooks.stripe.com",
      "*.mapbox.com",
      "api.mapbox.com",
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      // Match website warm background (HSL 30 20% 98%)
      backgroundColor: "#FAF8F5",
      showSpinner: false,
      launchAutoHide: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#FAF8F5",
    },
  },
  ios: {
    contentInset: "automatic",
    scheme: "Nooc",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#FAF8F5",
  },
}

export default config
