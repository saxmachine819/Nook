import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import EmailProvider from "next-auth/providers/email";
import { prisma } from "@/lib/prisma";
import { enqueueNotification } from "@/lib/notification-queue";
import { claimVenueMembershipForUser } from "@/lib/venue-members";
import { isAppleSignInConfigured } from "@/lib/apple-auth";

// Local dev only: force OAuth callbacks to localhost so sign-in works without .env.local override.
// Production (NODE_ENV=production on Vercel) is never touched.
if (process.env.NODE_ENV === "development") {
  process.env.NEXTAUTH_URL =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  console.log("[Auth] Dev mode NEXTAUTH_URL set to:", process.env.NEXTAUTH_URL);
}

// Verify required environment variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error("❌ Missing Google OAuth credentials!");
}

if (!process.env.NEXTAUTH_SECRET) {
  console.error("❌ Missing NEXTAUTH_SECRET!");
}

// NEXTAUTH_URL is optional when trustHost is true - NextAuth will use the request origin
// But it's still recommended to set it for production
if (!process.env.NEXTAUTH_URL) {
  console.warn(
    "⚠️ NEXTAUTH_URL not set - NextAuth will use request origin (OK for dev)"
  );
}

function buildProviders() {
  const providers: any[] = [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ];

  // Sign in with Apple — required by App Store Guideline 4.8 when Google is offered.
  // Prefer APPLE_SECRET (JWT). See lib/apple-auth.ts to generate from .p8 key material.
  if (process.env.APPLE_ID && process.env.APPLE_SECRET) {
    providers.push(
      AppleProvider({
        clientId: process.env.APPLE_ID,
        clientSecret: process.env.APPLE_SECRET,
      })
    );
  } else if (isAppleSignInConfigured()) {
    console.warn(
      "⚠️ Apple Sign In key material is set but APPLE_SECRET is missing. " +
        "Run: npx tsx scripts/generate-apple-client-secret.ts"
    );
  }

  if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
    providers.push(
      EmailProvider({
        server: process.env.EMAIL_SERVER,
        from: process.env.EMAIL_FROM,
      })
    );
  }

  return providers;
}

export const authOptions = {
  debug: true,
  trustHost: true, // Required for NextAuth v5
  useSecureCookies: process.env.NODE_ENV === "production",
  adapter: PrismaAdapter(prisma) as any,
  providers: buildProviders(),
  pages: {
    signIn: "/profile",
    verifyRequest: "/profile",
    error: "/api/auth/error",
  },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      // Allow all sign-ins for now
      return true;
    },
    async jwt({ token, user }: any) {
      // JWT callback is still called even with database sessions
      // Store user info in token for session callback
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, user }: any) {
      // With database sessions, 'user' comes from the database
      if (!user) {
        return session;
      }

      if (session?.user) {
        session.user.id = user.id;
        session.user.name = user.name;
        session.user.email = user.email;
        session.user.image = user.image;
        session.user.termsAcceptedAt = user.termsAcceptedAt;
      }

      if (!session.venueMembershipClaimed) {
        await claimVenueMembershipForUser(session.user);
        session.venueMembershipClaimed = true;
      }

      // First login: enqueue welcome email once per user (atomic claim).
      if (user.welcomeEmailSentAt == null && user.email?.trim()) {
        const result = await prisma.user.updateMany({
          where: { id: user.id, welcomeEmailSentAt: null },
          data: { welcomeEmailSentAt: new Date() },
        });
        if (result.count > 0) {
          try {
            const ctaUrl =
              process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
            await enqueueNotification({
              type: "welcome_user",
              dedupeKey: `welcome_user:${user.id}`,
              toEmail: user.email.trim(),
              userId: user.id,
              payload: { userName: user.name ?? undefined, ctaUrl },
            });
          } catch (err) {
            console.error("Failed to enqueue welcome_user:", err);
          }
        }
      }

      return session;
    },
  },
  session: {
    strategy: "database" as const, // Use database sessions with Prisma adapter
  },
};

// Create NextAuth instance (NextAuth v5)
const nextAuthInstance = NextAuth(authOptions);

// Export auth function and handlers
export const { auth, handlers } = nextAuthInstance;
