'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

interface DbCharacter {
    id: number;
    name: string;
    imageUrl: string;
    animeUniverse: string;
    stats: unknown;
    roleRatings: unknown;
}

export interface RoleStats {
    captain: number;
    viceCaptain: number;
    tank: number;
    duelist: number;
    support: number;
    reason?: string;
}

export interface CharacterItem {
    id: number;
    name: string;
    imageUrl: string;
    animeUniverse: string;
    stats: {
        favorites: number;
        roleStats: RoleStats;
    };
}

const ROLES_ORDER = ['captain', 'viceCaptain', 'tank', 'duelist', 'support'] as const;
const CHARACTER_CACHE_TTL_MS = 60_000;
const characterCache = new Map<number, { expiresAt: number; data: CharacterItem[] }>();

export async function getCharacters(limit = 500) {
    try {
        const now = Date.now();
        const cached = characterCache.get(limit);
        if (cached && cached.expiresAt > now) {
            return cached.data;
        }

        // Fetch more characters to allow client-side filtering
        const characters = await prisma.character.findMany({
            take: limit, // Increased limit for better variety
            orderBy: { stats: 'desc' },
        })

        // Just map them, don't slice yet. Client will filter and shuffle.
        const mapped = characters.map((char: DbCharacter) => {
            const stats = char.stats as { favorites: number };

            // Use stored AI ratings if available, otherwise random seed
            const aiStats = char.roleRatings as RoleStats | null;

            const seed = char.id + char.name.length;
            const r = (n: number) => ((seed + n) % 5) + 1;

            const roleStats: RoleStats = aiStats || {
                captain: r(0),
                viceCaptain: r(1),
                tank: r(2),
                duelist: r(3),
                support: r(4),
            };

            return {
                ...char,
                stats: {
                    favorites: stats.favorites,
                    roleStats
                }
            };
        });
        characterCache.set(limit, { expiresAt: now + CHARACTER_CACHE_TTL_MS, data: mapped });
        return mapped;
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('Failed to fetch characters:', error);
        }
        return []
    }
}

export async function submitMatch(userId: string, userTeam: (CharacterItem | null)[], cpuTeam: (CharacterItem | null)[]) {
    let userScore = 0;
    let cpuScore = 0;
    const logs: string[] = [];

    const rolesDisplay = ['CAPTAIN', 'VICE CAPTAIN', 'TANK', 'DUELIST', 'SUPPORT'];

    for (let i = 0; i < 5; i++) {
        const role = ROLES_ORDER[i];
        const roleName = rolesDisplay[i];

        const userChar = userTeam[i];
        const cpuChar = cpuTeam[i];

        if (!userChar || !cpuChar) {
            logs.push(`${roleName}: ROUND SKIPPED (Missing Character)`);
            continue;
        }

        // Safe Access
        const userRoleStats = userChar.stats?.roleStats || { captain: 1, viceCaptain: 1, tank: 1, duelist: 1, support: 1 };
        const cpuRoleStats = cpuChar.stats?.roleStats || { captain: 1, viceCaptain: 1, tank: 1, duelist: 1, support: 1 };

        const userStars = userRoleStats[role] || 1;
        const cpuStars = cpuRoleStats[role] || 1;

        const userBase = Math.log(userChar.stats?.favorites || 100);
        const userTotal = userBase + (userStars * 3);

        const cpuBase = Math.log(cpuChar.stats?.favorites || 100);
        const cpuTotal = cpuBase + (cpuStars * 3);

        if (userTotal > cpuTotal) {
            userScore++;
            logs.push(`${roleName}: ✅ ${userChar.name} (Pwr: ${userTotal.toFixed(1)}) DEFEATS ❌ ${cpuChar.name} (Pwr: ${cpuTotal.toFixed(1)})`);
            logs.push(`   > You: Pwr ${userBase.toFixed(1)} + (${userStars}⭐ * 3) = ${userTotal.toFixed(1)}`);
            logs.push(`   > CPU: Pwr ${cpuBase.toFixed(1)} + (${cpuStars}⭐ * 3) = ${cpuTotal.toFixed(1)}`);
        } else {
            cpuScore++;
            logs.push(`${roleName}: ❌ ${userChar.name} (Pwr: ${userTotal.toFixed(1)}) LOSES TO ✅ ${cpuChar.name} (Pwr: ${cpuTotal.toFixed(1)})`);
            logs.push(`   > You: Pwr ${userBase.toFixed(1)} + (${userStars}⭐ * 3) = ${userTotal.toFixed(1)}`);
            logs.push(`   > CPU: Pwr ${cpuBase.toFixed(1)} + (${cpuStars}⭐ * 3) = ${cpuTotal.toFixed(1)}`);
        }
    }

    const isWin = userScore > cpuScore;
    logs.push(isWin ? `FINAL SCORE: ${userScore}-${cpuScore} (VICTORY!)` : `FINAL SCORE: ${userScore}-${cpuScore} (DEFEAT!)`);

    // Try creating match, ignore user update if not auth
    try {
        if (userId && userId !== 'user-123') { // ignore mock ID
            await prisma.user.update({
                where: { id: userId },
                data: {
                    wins: isWin ? { increment: 1 } : undefined,
                    losses: !isWin ? { increment: 1 } : undefined,
                }
            });
        }

        // Only create match if we have data
        await prisma.match.create({
            data: {
                winnerId: isWin ? (userId !== 'user-123' ? userId : "Anonymous") : 'CPU',
                teamDrafted: JSON.parse(JSON.stringify({ user: userTeam, cpu: cpuTeam })),
            }
        });

    } catch (e) {
        if (process.env.NODE_ENV === 'development') {
            console.error("Database error in submitMatch:", e);
        }
        // We continue to return result even if DB fails
    }

    revalidatePath('/');
    return { isWin, userScore, cpuScore, logs };
}

export async function getLeaderboard() {
    try {
        const topUsers = await prisma.user.findMany({
            take: 10,
            orderBy: {
                wins: 'desc',
            },
            select: {
                id: true,
                username: true,
                avatarUrl: true,
                wins: true,
                losses: true,
            }
        });
        return topUsers;
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('Failed to fetch leaderboard:', error);
        }
        return [];
    }
}

export async function updateUserStats(userId: string, outcome: 'win' | 'loss') {
    if (!userId) return;
    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                wins: outcome === 'win' ? { increment: 1 } : undefined,
                losses: outcome === 'loss' ? { increment: 1 } : undefined,
            }
        });
        revalidatePath('/');
    } catch (e) {
        if (process.env.NODE_ENV === 'development') {
            console.error("Failed to update user stats:", e);
        }
    }
}
