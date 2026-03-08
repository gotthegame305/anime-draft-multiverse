import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

const ANIME_MAPPING: Record<string, number> = {
    "Dragon Ball Z": 813,
    "Dragon Ball": 231,
    "Naruto": 20,
    "One Piece": 21,
    "Jujutsu Kaisen": 40748,
    "Bleach": 269,
    "Hunter x Hunter": 11061,
    "Attack on Titan": 16498,
    "Fate": 22043,
    "Star Wars": 49352,
    "Marvel Comics": 34951,
    "DC Comics": 35335,
};

const MIN_FAVORITES = 50;
const JIKAN_DELAY = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const type = searchParams.get('type') || 'seed';
    const targetAnimeId = searchParams.get('animeId');

    if (secret !== 'anime123') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        if (type === 'jikan') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const results: any[] = [];
            let seriesToProcess: { name: string, id: number | null }[] = [];

            if (targetAnimeId) {
                seriesToProcess = [{ name: "Target ID", id: parseInt(targetAnimeId) }];
            } else {
                const filePath = path.join(process.cwd(), 'scripts', 'static-characters.json');
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(fileContent);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const uniqueSeries = Array.from(new Set(data.map((c: any) => c.series))) as string[];
                
                seriesToProcess = uniqueSeries.map(s => ({
                    name: s,
                    id: ANIME_MAPPING[s] || null
                }));
            }

            for (const seriesObj of seriesToProcess) {
                let animeId = seriesObj.id;
                const animeName = seriesObj.name;

                if (!animeId) {
                    console.log(`Searching Jikan for: ${animeName}`);
                    await sleep(JIKAN_DELAY);
                    const searchRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(animeName)}&limit=1`);
                    if (searchRes.ok) {
                        const searchJson = await searchRes.json();
                        if (searchJson.data && searchJson.data.length > 0) {
                            animeId = searchJson.data[0].mal_id;
                        }
                    }
                }

                if (!animeId) {
                    results.push({ series: animeName, success: false, error: "MAL ID not found" });
                    continue;
                }
                
                await sleep(JIKAN_DELAY);
                const charRes = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/characters`);
                
                if (!charRes.ok) {
                    results.push({ animeName, animeId, success: false, error: `Jikan API: ${charRes.statusText}` });
                    continue;
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
                        update: {
                            name: character.name,
                            imageUrl: character.images.jpg.image_url,
                            animeUniverse: animeName,
                            stats: { favorites },
                        },
                        create: {
                            id: character.mal_id,
                            name: character.name,
                            imageUrl: character.images.jpg.image_url,
                            animeUniverse: animeName,
                            stats: { favorites },
                        },
                    });
                }
                results.push({ animeName, animeId, count: filtered.length, success: true });
            }
            return NextResponse.json({ success: true, results });
        }

        // Static Stats Seeding
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
