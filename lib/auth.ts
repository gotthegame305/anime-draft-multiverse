import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import DiscordProvider from "next-auth/providers/discord"
import prisma from "@/lib/prisma"

const getEnv = (key: string) => process.env[key] || process.env[`NEXT_PUBLIC_${key}`] || "";

export const authOptions: NextAuthOptions = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: PrismaAdapter(prisma as any),
    secret: getEnv("NEXTAUTH_SECRET") || "fallback_secret_for_build",
    providers: [
        GoogleProvider({
            clientId: getEnv("GOOGLE_CLIENT_ID") || "placeholder_id",
            clientSecret: getEnv("GOOGLE_CLIENT_SECRET") || "placeholder_secret",
        }),
        DiscordProvider({
            clientId: getEnv("DISCORD_CLIENT_ID") || "placeholder_id",
            clientSecret: getEnv("DISCORD_CLIENT_SECRET") || "placeholder_secret",
        }),
    ],
    callbacks: {
        async session({ session, user }) {
            if (session?.user && user) {
                // @ts-ignore - session.user type issue
                session.user.id = user.id;
            }
            return session;
        },
    },
    pages: {
        signIn: '/auth/signin',
    },
};
