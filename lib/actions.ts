"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export type LeaderboardEntry = {
    username: string
    avatarUrl: string
    wins: number
    losses: number
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
    const users = await prisma.user.findMany({
        orderBy: {
            wins: 'desc',
        },
        take: 10,
        select: {
            username: true,
            avatarUrl: true,
            wins: true,
            losses: true,
            // Fallback to NextAuth fields if custom ones aren't set yet
            name: true,
            image: true,
        },
    })

    // Normalize data for the frontend
    return users.map((user: any) => ({
        username: user.username || user.name || "Anonymous",
        avatarUrl: user.avatarUrl || user.image || "/placeholder-avatar.png",
        wins: user.wins,
        losses: user.losses,
    }))
}

export async function updateUserStats(userId: string, result: "WIN" | "LOSS") {
    if (!userId) return;

    try {
        if (result === "WIN") {
            await prisma.user.update({
                where: { id: userId },
                data: { wins: { increment: 1 } },
            })
        } else {
            await prisma.user.update({
                where: { id: userId },
                data: { losses: { increment: 1 } },
            })
        }

        // Revalidate the leaderboard or home page where stats are shown
        revalidatePath("/")
    } catch (error) {
        console.error("Failed to update user stats:", error)
        // We could throw here, but usually game logic shouldn't crash the whole app if stats fail
    }
}
