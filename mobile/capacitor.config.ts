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
      // Matches the Splash.imageset artwork's own background so there's no
      // color seam between it and this native-drawn backdrop.
      backgroundColor: "#052A10",
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
    // "never" is required for position:fixed to actually stay fixed. With
    // "automatic", iOS gives the WebView's scroll view top/bottom safe-area
    // content insets, and that inset region is genuinely scrollable range
    // beyond the content — scroll into it and WebKit shifts fixed elements
    // (the bottom nav visibly lifts ~45pt off the bottom at the end of a
    // scroll). bounces=false doesn't prevent it because it isn't bounce.
    // Trade-off: the WebView now spans the full screen, so safe-area spacing
    // becomes our job in CSS (see globals.css).
    contentInset: "never",
    scheme: "Nooc",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#FAF8F5",
  },
}

export default config
