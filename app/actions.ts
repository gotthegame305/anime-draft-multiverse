'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { simulateMatchup, RoleKey } from '@/lib/battleEngine'
import { BASE_ROLES } from '@/lib/gameConfig'



export interface RoleStats {
    captain: number;
    viceCaptain: number;
    tank: number;
    duelist: number;
    support: number;
    aura: number;
    traitor: number;
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

const CHARACTER_CACHE_TTL_MS = 60_000;
const characterCache = new Map<number, { expiresAt: number; data: CharacterItem[] }>();

export async function getCharacters(limit = 500) {
    try {
        const now = Date.now();
        const cached = characterCache.get(limit);
        if (cached && cached.expiresAt > now) {
            return cached.data;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const staticStats = await (prisma as any).staticCharacter?.findMany() || [];
        const statMap = new Map();
        staticStats.forEach((s: Record<string, unknown>) => {
            const name = s.name as string;
            statMap.set(name, s);
            // Also index by last word only as fallback (e.g. "Luffy" matches "Monkey D. Luffy")
            const lastName = name.split(' ').pop() || name;
            if (!statMap.has(lastName)) statMap.set(lastName, s);
        });

        // Fetch more characters to allow client-side filtering
        const characters = await prisma.character.findMany({
            take: limit,
            orderBy: { stats: 'desc' },
        })

        // Just map them, don't slice yet. Client will filter and shuffle.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = characters.map((char: any) => {
            const apiStats = char.stats as { favorites: number } | null;
            const aiStats = char.roleRatings as RoleStats | null;
            // Normalize Jikan "Last, First" → "First Last" for matching
            const normalizeName = (n: string) => {
                if (n.includes(', ')) {
                    const [last, first] = n.split(', ');
                    return `${first} ${last}`.trim();
                }
                return n.trim();
            };
            const jikanFirstName = char.name.includes(', ') ? char.name.split(', ')[1] : char.name;
            const staticChar = statMap.get(char.name)
                || statMap.get(normalizeName(char.name))
                || statMap.get(jikanFirstName);

            // Use the authoritative static stats if available
            let roleStats: RoleStats;
            let favorites = apiStats?.favorites || 0;

            if (staticChar) {
                favorites = staticChar.favorites > 0 ? staticChar.favorites : favorites;
                roleStats = {
                    captain: staticChar.captain,
                    viceCaptain: staticChar.viceCaptain,
                    tank: staticChar.tank,
                    duelist: staticChar.duelist,
                    support: staticChar.support,
                    aura: staticChar.aura,
                    traitor: staticChar.traitor,
                    reason: "Verified Database Stats"
                };
            } else {
                // Fallback: Random seed
                const seed = char.id + char.name.length;
                const r = (n: number) => ((seed + n) % 5) + 1;

                roleStats = aiStats || {
                    captain: r(0),
                    viceCaptain: r(1),
                    tank: r(2),
                    duelist: r(3),
                    support: r(4),
                    aura: r(5),
                    traitor: r(6),
                };
            }

            return {
                ...char,
                stats: {
                    favorites,
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

// userId is null for guests — they play but their results are not recorded
export async function submitMatch(
    userId: string | null,
    userTeam: (CharacterItem | null)[],
    cpuTeam: (CharacterItem | null)[],
    rolesPlayed: RoleKey[] = [...BASE_ROLES]
) {
    const { isWin, userScore, cpuScore, logs } = simulateMatchup(userTeam, cpuTeam, rolesPlayed, "You", "CPU");

    // Only persist stats for authenticated (logged-in) users — guests play without being recorded
    if (userId) {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    wins: isWin ? { increment: 1 } : undefined,
                    losses: !isWin ? { increment: 1 } : undefined,
                }
            });

            // Only create a match record when we have a real winner user ID
            if (isWin) {
                await prisma.match.create({
                    data: {
                        winnerId: userId,
                        teamDrafted: JSON.parse(JSON.stringify({ user: userTeam, cpu: cpuTeam })),
                    }
                });
            }
        } catch (e) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Database error in submitMatch:', e);
            }
            // Continue to return result even if DB write fails
        }

        revalidatePath('/');
    }

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
            console.error('Failed to update user stats:', e);
        }
    }
}
