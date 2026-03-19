'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { simulateMatchup } from '@/lib/battleEngine'
import type { RoleKey } from '@/lib/battleEngine'
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

const NAME_ALIASES: Record<string, string> = {
    // Dragon Ball
    freeza: 'frieza',
    kuririn: 'krillin',
    tenshinhan: 'tien shinhan',
    'muten roushi': 'master roshi',
    'jinzouningen 16 gou': 'android 16',
    'jinzouningen 17 gou': 'android 17',
    'jinzouningen 18 gou': 'android 18',
    vegetto: 'vegito',
    'gokuu son': 'goku',
    'gohan son': 'gohan',
    'goten son': 'goten',
    'piccolo daimao': 'piccolo',
    // Fate
    atalanta: 'atalante',
    'first hassan': 'king hassan',
    // Naruto
    'might guy': 'might, guy',
    tobi: 'obito uchiha',
    // One Piece
    'charlotte linlin': 'big mom',
    kuzan: 'aokiji',
    'donquixote rosinante': 'corazon',
    borsalino: 'kizaru',
    'edward newgate': 'whitebeard',
}

function reorderCommaName(name: string) {
    if (!name.includes(',')) return name.trim();

    const [last, first] = name.split(',').map(part => part.trim());
    if (!first) return name.trim();

    return `${first} ${last}`.trim();
}

function toLookupKey(name: string) {
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function foldRomanizedLongVowels(name: string) {
    return name
        .replace(/ou/g, 'o')
        .replace(/oo/g, 'o')
        .replace(/uu/g, 'u');
}

function getLookupKeys(name: string) {
    const candidates = new Set<string>();
    const trimmed = name.trim();
    const reordered = reorderCommaName(trimmed);
    const lastWord = reordered.split(' ').pop() || reordered;
    const commaFirst = trimmed.includes(',') ? trimmed.split(',').slice(1).join(',').trim() : trimmed;

    [trimmed, reordered, lastWord, commaFirst].forEach(candidate => {
        if (!candidate) return;

        const normalized = toLookupKey(candidate);
        const aliased = NAME_ALIASES[normalized];
        if (!normalized) return;

        candidates.add(normalized);
        candidates.add(foldRomanizedLongVowels(normalized));
        if (aliased) {
            candidates.add(toLookupKey(aliased));
            candidates.add(foldRomanizedLongVowels(toLookupKey(aliased)));
        }
    });

    return Array.from(candidates);
}

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
            getLookupKeys(name).forEach((key) => {
                if (!statMap.has(key)) {
                    statMap.set(key, s);
                }
            });
        });

        const characters = await prisma.character.findMany({
            take: limit,
            orderBy: { stats: 'desc' },
        })

        // Only surface characters backed by static JSON stats.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = characters.flatMap((char: any) => {
            const apiStats = char.stats as { favorites: number } | null;
            const staticChar = getLookupKeys(char.name)
                .map((key) => statMap.get(key))
                .find(Boolean);

            if (!staticChar) {
                return [];
            }

            const favorites = staticChar.favorites > 0 ? staticChar.favorites : (apiStats?.favorites || 0);
            const roleStats: RoleStats = {
                captain: staticChar.captain,
                viceCaptain: staticChar.viceCaptain,
                tank: staticChar.tank,
                duelist: staticChar.duelist,
                support: staticChar.support,
                aura: staticChar.aura,
                traitor: staticChar.traitor,
                reason: "Verified Database Stats"
            };

            return [{
                ...char,
                stats: {
                    favorites,
                    roleStats
                }
            }];
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

// userId is null for guests - they play but their results are not recorded
export async function submitMatch(
    userId: string | null,
    userTeam: (CharacterItem | null)[],
    cpuTeam: (CharacterItem | null)[],
    rolesPlayed: RoleKey[] = [...BASE_ROLES]
) {
    const { isWin, userScore, cpuScore, logs, userBreakdown, cpuBreakdown } = simulateMatchup(userTeam, cpuTeam, rolesPlayed, "You", "CPU");

    // Only persist stats for authenticated (logged-in) users - guests play without being recorded
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

    return { isWin, userScore, cpuScore, logs, userBreakdown, cpuBreakdown };
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
