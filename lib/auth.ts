import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import { prisma } from "@/lib/prisma"
import type { NextAuthOptions } from "next-auth"

// Verify required environment variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error("❌ Missing Google OAuth credentials!")
}

if (!process.env.NEXTAUTH_SECRET) {
  console.error("❌ Missing NEXTAUTH_SECRET!")
}

if (!process.env.NEXTAUTH_URL) {
  console.error("❌ Missing NEXTAUTH_URL!")
}

export const authOptions: NextAuthOptions = {
  debug: true, // Always debug for now
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
    async signIn({ user, account, profile }) {
      // Allow all sign-ins for now
      return true
    },
    async jwt({ token, user }) {
      // JWT callback is still called even with database sessions
      // Store user info in token for session callback
      if (user) {
        token.id = user.id
        token.name = user.name
        token.email = user.email
        token.picture = user.image
      }
      return token
    },
    async session({ session, user }) {
      // With database sessions, 'user' comes from the database
      if (!user) {
        return session
      }
      
      if (session?.user) {
        session.user.id = user.id
        session.user.name = user.name
        session.user.email = user.email
        session.user.image = user.image
      }
      return session
    },
  },
  session: {
    strategy: "database", // Use database sessions with Prisma adapter
  },
}

// Create NextAuth instance (NextAuth v5)
const nextAuthInstance = NextAuth(authOptions)

// Export auth function and handlers
export const { auth, handlers } = nextAuthInstance
