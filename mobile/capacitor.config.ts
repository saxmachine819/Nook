import type { CapacitorConfig } from "@capacitor/cli"

const APP_URL =
  process.env.MOBILE_SERVER_URL ||
  process.env.NEXT_PUBLIC_MOBILE_APP_URL ||
  "https://nooc.io"

const config: CapacitorConfig = {
  appId: "io.nooc.app",
  appName: "Nooc",
  webDir: "www",
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
      backgroundColor: "#0B1F1A",
      showSpinner: false,
      launchAutoHide: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0B1F1A",
    },
  },
  ios: {
    contentInset: "automatic",
    scheme: "Nooc",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0B1F1A",
  },
}

export default config
