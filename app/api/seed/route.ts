import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

const ANIME_MAPPING: Record<string, number> = {
    "Dragon Ball Z": 813,
    "Naruto": 20,
    "One Piece": 21,
    "Jujutsu Kaisen": 40748,
    "Bleach": 269,
    "Hunter x Hunter": 11061,
};

const MIN_FAVORITES = 50;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const type = searchParams.get('type') || 'static';
    const targetAnimeId = searchParams.get('animeId');

    // Simple security check
    if (secret !== 'anime123') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        if (type === 'jikan') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const results: any[] = [];
            const idsToSeed = targetAnimeId 
                ? [parseInt(targetAnimeId)] 
                : Object.values(ANIME_MAPPING);

            for (const animeId of idsToSeed) {
                const animeName = Object.keys(ANIME_MAPPING).find(key => ANIME_MAPPING[key] === animeId) || "Unknown Anime";
                
                console.log(`Fetching characters for ${animeName} (${animeId})...`);
                const res = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/characters`);
                
                if (!res.ok) {
                    results.push({ animeId, success: false, error: `Jikan API error: ${res.statusText}` });
                    continue;
                }

                const json = await res.json();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const characters = json.data as any[];
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const filtered = characters.filter((c: any) => c.favorites > MIN_FAVORITES);
                
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

        const filePath = path.join(process.cwd(), 'scripts', 'static-characters.json');
        
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'Static data file not found at ' + filePath }, { status: 404 });
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);

        console.log(`Starting seed of ${data.length} characters...`);

        let count = 0;
        // Batching for performance and to avoid transaction timeouts
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await Promise.all(batch.map((char: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return (prisma as any).staticCharacter.upsert({
                    where: { name: char.name as string },
                    update: {
                        favorites: char.favorites as number,
                        winRate: char.winRate as number,
                        viceCaptain: char.viceCaptain as number,
                        tank: char.tank as number,
                        duelist: char.duelist as number,
                        support: char.support as number,
                        aura: char.aura as number,
                        traitor: char.traitor as number,
                    },
                    create: {
                        name: char.name as string,
                        favorites: char.favorites as number,
                        winRate: char.winRate as number,
                        captain: char.captain as number,
                        viceCaptain: char.viceCaptain as number,
                        tank: char.tank as number,
                        duelist: char.duelist as number,
                        support: char.support as number,
                        aura: char.aura as number,
                        traitor: char.traitor as number,
                    }
                });
            }));
            
            count += batch.length;
            console.log(`Seeded ${count} / ${data.length}...`);
        }

        return NextResponse.json({ 
            success: true, 
            message: `Successfully seeded ${count} characters.` 
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during seeding';
        console.error('Seeding error:', error);
        return NextResponse.json({ 
            success: false, 
            error: errorMessage 
        }, { status: 500 });
    }
}
