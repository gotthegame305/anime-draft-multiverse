import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import DiscordProvider from "next-auth/providers/discord"
import prisma from "@/lib/prisma"

// Debug logs for environment presence (safe)
if (typeof window === 'undefined') {
    console.log('[AUTH_DEBUG] Checking environment variables...');
    console.log('[AUTH_DEBUG] GOOGLE_ID:', !!process.env.GOOGLE_CLIENT_ID);
    console.log('[AUTH_DEBUG] DISCORD_ID:', !!process.env.DISCORD_CLIENT_ID);
    console.log('[AUTH_DEBUG] NEXTAUTH_SECRET:', !!process.env.NEXTAUTH_SECRET);
    console.log('[AUTH_DEBUG] NEXTAUTH_URL:', !!process.env.NEXTAUTH_URL);
}

export const authOptions: NextAuthOptions = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: PrismaAdapter(prisma as any),
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async session({ session, user }) {
            if (session.user) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (session.user as any).id = user.id;
            }
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_dev_only",
}
