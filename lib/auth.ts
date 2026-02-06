import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { prisma } from "@/lib/prisma";
import { enqueueNotification } from "@/lib/notification-queue";

// Local dev only: force OAuth callbacks to localhost so sign-in works without .env.local override.
// Production (NODE_ENV=production on Vercel) is never touched.
if (process.env.NODE_ENV === "development") {
  process.env.NEXTAUTH_URL =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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

export const authOptions = {
  debug: false,
  trustHost: true, // Required for NextAuth v5
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Only enable EmailProvider if EMAIL_SERVER is configured
    ...(process.env.EMAIL_SERVER && process.env.EMAIL_FROM
      ? [
          EmailProvider({
            server: process.env.EMAIL_SERVER,
            from: process.env.EMAIL_FROM,
          }),
        ]
      : []),
  ],
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

      // Venue ownership summary for nav (Manage item).
      try {
        const count = await prisma.venue.count({
          where: {
            ownerId: user.id,
            status: { not: "DELETED" },
          },
        })
        let singleVenueId: string | null = null
        if (count === 1) {
          const venue = await prisma.venue.findFirst({
            where: {
              ownerId: user.id,
              status: { not: "DELETED" },
            },
            select: { id: true },
          })
          singleVenueId = venue?.id ?? null
        }
        if (session?.user) {
          session.user.venueSummary = { count, singleVenueId }
        }
      } catch (err) {
        if (session?.user) {
          session.user.venueSummary = { count: 0, singleVenueId: null }
        }
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
