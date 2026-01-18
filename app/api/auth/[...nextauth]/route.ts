import NextAuth, { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import DiscordProvider from "next-auth/providers/discord"
import prisma from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "placeholder_id",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "placeholder_secret",
        }),
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID ?? "placeholder_id",
            clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "placeholder_secret",
        }),
    ],
    callbacks: {
        async session({ session, user }) {
            if (session.user) {
                session.user.id = user.id;
                // Map database fields to session user if needed
                // session.user.username = user.username; // If we extended the type
            }
            return session;
        },
    },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
