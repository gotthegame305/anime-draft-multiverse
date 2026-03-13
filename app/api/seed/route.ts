import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

// Series that map to multiple anime IDs
const ANIME_MAPPING: Record<string, number[]> = {
    "Dragon Ball": [231, 813],
    "Dragon Ball Z": [813],
    "Naruto": [20, 1735],
    "One Piece": [21],
    "Jujutsu Kaisen": [40748],
    "Bleach": [269],
    "Hunter x Hunter": [11061],
    "Attack on Titan": [16498],
    "Fate": [
        356,    // Fate/stay night (original)
        10087,  // Fate/Zero
        22297,  // Fate/stay night: Unlimited Blade Works
        34662,  // Fate/Apocrypha
        38084,  // Fate/Grand Order: Babylonia
        43487,  // Fate/Grand Order: Camelot
        14829,  // Fate/kaleid liner Prisma Illya
        39533,  // Fate/Grand Order: Absolute Demonic Front
    ],
};

// These series use Comic Vine instead of Jikan
const COMIC_VINE_SERIES = ["Marvel Comics", "DC Comics", "Star Wars"];

const MIN_FAVORITES = 50;
const FATE_MIN_FAVORITES = 0; // Fate characters have low favorites on Jikan
const JIKAN_DELAY = 1200;
const COMIC_VINE_DELAY = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

// Rotate through 3 Comic Vine API keys to avoid rate limits
const COMIC_VINE_KEYS = [
    process.env.COMIC_VINE_KEY_1,
    process.env.COMIC_VINE_KEY_2,
    process.env.COMIC_VINE_KEY_3,
].filter(Boolean) as string[];

let cvKeyIndex = 0;
function getComicVineKey(): string {
    const key = COMIC_VINE_KEYS[cvKeyIndex % COMIC_VINE_KEYS.length];
    cvKeyIndex++;
    return key;
}

async function fetchComicVineCharacter(name: string): Promise<{ imageUrl: string | null }> {
    try {
        const key = getComicVineKey();
        await sleep(COMIC_VINE_DELAY);
        const url = `https://comicvine.gamespot.com/api/characters/?api_key=${key}&format=json&filter=name:${encodeURIComponent(name)}&field_list=name,image&limit=1`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'AnimeDraftMultiverse/1.0' }
        });
        if (!res.ok) return { imageUrl: null };
        const json = await res.json();
        if (json.results && json.results.length > 0) {
            const img = json.results[0].image?.medium_url || json.results[0].image?.original_url || null;
            return { imageUrl: img };
        }
        return { imageUrl: null };
    } catch {
        return { imageUrl: null };
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const type = searchParams.get('type') || 'seed';
    const targetAnimeId = searchParams.get('animeId');

    if (secret !== 'anime123') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {

        // ── JIKAN SEEDING ──────────────────────────────────────────────
        if (type === 'jikan') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const results: any[] = [];

            if (targetAnimeId) {
                const animeId = parseInt(targetAnimeId);
                await sleep(JIKAN_DELAY);
                const charRes = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/characters`);
                if (!charRes.ok) {
                    return NextResponse.json({ success: false, error: `Jikan API: ${charRes.statusText}` });
                }
                const json = await charRes.json();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const characters = json.data as any[];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const filtered = characters.filter((c: any) => c.favorites > MIN_FAVORITES || c.role === 'Main');
                for (const charData of filtered) {
                    const { character, favorites } = charData;
                    await prisma.character.upsert({
                        where: { id: character.mal_id },
                        update: { name: character.name, imageUrl: character.images.jpg.image_url, stats: { favorites } },
                        create: { id: character.mal_id, name: character.name, imageUrl: character.images.jpg.image_url, animeUniverse: "Target ID", stats: { favorites } },
                    });
                }
                return NextResponse.json({ success: true, count: filtered.length });
            }

            const filePath = path.join(process.cwd(), 'scripts', 'static-characters.json');
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(fileContent);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const uniqueSeries = Array.from(new Set(data.map((c: any) => c.series))) as string[];

            for (const animeName of uniqueSeries) {
                // Skip Comic Vine series
                if (COMIC_VINE_SERIES.includes(animeName)) {
                    results.push({ animeName, success: false, error: "Use type=comicvine for this series" });
                    continue;
                }

                const mappedIds = ANIME_MAPPING[animeName];
                const idsToFetch: number[] = mappedIds && mappedIds.length > 0 ? [...mappedIds] : [];

                if (idsToFetch.length === 0) {
                    console.log(`Searching Jikan for: ${animeName}`);
                    await sleep(JIKAN_DELAY);
                    const searchRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(animeName)}&limit=1`);
                    if (searchRes.ok) {
                        const searchJson = await searchRes.json();
                        if (searchJson.data && searchJson.data.length > 0) {
                            idsToFetch.push(searchJson.data[0].mal_id);
                        }
                    }
                }

                if (idsToFetch.length === 0) {
                    results.push({ animeName, success: false, error: "MAL ID not found" });
                    continue;
                }

                let totalCount = 0;
                for (const animeId of idsToFetch) {
                    await sleep(JIKAN_DELAY);
                    const charRes = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/characters`);
                    if (!charRes.ok) continue;
                    const json = await charRes.json();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const characters = json.data as any[];
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const filtered = characters.filter((c: any) => c.favorites > (animeName === 'Fate' ? FATE_MIN_FAVORITES : MIN_FAVORITES) || c.role === 'Main');
                    for (const charData of filtered) {
                        const { character, favorites } = charData;
                        await prisma.character.upsert({
                            where: { id: character.mal_id },
                            update: { name: character.name, imageUrl: character.images.jpg.image_url, animeUniverse: animeName, stats: { favorites } },
                            create: { id: character.mal_id, name: character.name, imageUrl: character.images.jpg.image_url, animeUniverse: animeName, stats: { favorites } },
                        });
                    }
                    totalCount += filtered.length;
                }
                results.push({ animeName, ids: idsToFetch, count: totalCount, success: true });
            }
            return NextResponse.json({ success: true, results });
        }

        // ── COMIC VINE SEEDING (Marvel, DC, Star Wars) ─────────────────
        if (type === 'comicvine') {
            if (COMIC_VINE_KEYS.length === 0) {
                return NextResponse.json({ error: 'No Comic Vine API keys found. Set COMIC_VINE_KEY_1/2/3 in env.' }, { status: 500 });
            }

            const filePath = path.join(process.cwd(), 'scripts', 'static-characters.json');
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(fileContent);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cvCharacters = data.filter((c: any) => COMIC_VINE_SERIES.includes(c.series));

            console.log(`Seeding ${cvCharacters.length} Comic Vine characters...`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const results: any[] = [];
            let successCount = 0;
            let failCount = 0;
            let cvId = -1;

            for (const char of cvCharacters) {
                // Check if already seeded by name
                const existing = await prisma.character.findFirst({ where: { name: char.name } });
                if (existing) {
                    results.push({ name: char.name, status: 'already exists' });
                    successCount++;
                    continue;
                }

                // Find lowest available negative ID
                const lowestChar = await prisma.character.findFirst({ orderBy: { id: 'asc' } });
                cvId = lowestChar && lowestChar.id < 0 ? lowestChar.id - 1 : -1;

                const { imageUrl } = await fetchComicVineCharacter(char.name);
                const finalImageUrl = imageUrl || '/placeholder-character.png';

                await prisma.character.create({
                    data: {
                        id: cvId,
                        name: char.name,
                        imageUrl: finalImageUrl,
                        animeUniverse: char.series,
                        stats: { favorites: char.favorites },
                    },
                });

                results.push({ name: char.name, series: char.series, imageFound: !!imageUrl });
                if (imageUrl) successCount++; else failCount++;
            }

            return NextResponse.json({
                success: true,
                message: `Processed ${cvCharacters.length} characters. Images found: ${successCount}, placeholder used: ${failCount}`,
                results
            });
        }

        // ── STATIC STATS SEEDING ───────────────────────────────────────
        if (type === 'check') {
            const characters = await prisma.character.findMany({
                orderBy: [
                    { animeUniverse: 'asc' },
                    { name: 'asc' },
                ],
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const staticStats = await (prisma as any).staticCharacter.findMany();

            const statMap = new Map<string, string>();
            staticStats.forEach((s: { name: string }) => {
                getLookupKeys(s.name).forEach((key) => {
                    if (!statMap.has(key)) {
                        statMap.set(key, s.name);
                    }
                });
            });

            const unverified = characters
                .filter((char) => !getLookupKeys(char.name).some((key) => statMap.has(key)))
                .map((char) => ({ name: char.name, universe: char.animeUniverse }));

            return NextResponse.json({
                total: characters.length,
                unverified: unverified.length,
                verified: characters.length - unverified.length,
                characters: unverified,
            });
        }

        const filePath = path.join(process.cwd(), 'scripts', 'static-characters.json');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);

        console.log(`Seeding ${data.length} static stats...`);
        let count = 0;
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await Promise.all(batch.map((char: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return (prisma as any).staticCharacter.upsert({
                    where: { name: char.name as string },
                    update: {
                        favorites: char.favorites || 0,
                        winRate: char.winRate || 0.5,
                        captain: char.captain || 1,
                        viceCaptain: char.viceCaptain || 1,
                        tank: char.tank || 1,
                        duelist: char.duelist || 1,
                        support: char.support || 1,
                        aura: char.aura || 1,
                        traitor: char.traitor || 1,
                    },
                    create: {
                        name: char.name as string,
                        series: char.series || 'Unknown',
                        favorites: char.favorites || 0,
                        winRate: char.winRate || 0.5,
                        captain: char.captain || 1,
                        viceCaptain: char.viceCaptain || 1,
                        tank: char.tank || 1,
                        duelist: char.duelist || 1,
                        support: char.support || 1,
                        aura: char.aura || 1,
                        traitor: char.traitor || 1,
                    }
                });
            }));
            count += batch.length;
        }

        return NextResponse.json({ success: true, message: `Seeded ${count} stats.` });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('Seed Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
