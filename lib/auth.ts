import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import DiscordProvider from "next-auth/providers/discord"
import prisma from "@/lib/prisma"

const getEnv = (key: string) => process.env[key] || "";

export const authOptions: NextAuthOptions = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: PrismaAdapter(prisma as any),
    secret: process.env.NEXTAUTH_SECRET,
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
                session.user.id = user.id;
            }
            return session;
        },
    },
    pages: {
        signIn: '/auth/signin',
    },
};
