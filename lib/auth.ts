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
    session: {
        strategy: "jwt",
    },
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
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session?.user && token?.id) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },
    pages: {
        signIn: '/auth/signin',
    },
};
