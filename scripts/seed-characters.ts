
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANIME_MAPPING: Record<string, number> = {
    "Dragon Ball Z": 813,
    "Naruto": 20,
    "One Piece": 21,
    "Jujutsu Kaisen": 40748,
    "Bleach": 269,
    "Hunter x Hunter": 11061,
};

const MIN_FAVORITES = 50;
const DELAY_MS = 1000;

interface JikanCharacterResponse {
    character: {
        mal_id: number;
        url: string;
        images: {
            jpg: {
                image_url: string;
            };
        };
        name: string;
    };
    role: string;
    favorites: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchCharactersForAnime(animeId: number) {
    const url = `https://api.jikan.moe/v4/anime/${animeId}/characters`;
    console.log(`Fetching characters from: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch characters for anime ${animeId}: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data as JikanCharacterResponse[];
}

async function main() {
    console.log('Starting seed...');

    for (const [animeName, animeId] of Object.entries(ANIME_MAPPING)) {
        try {
            console.log(`Found Anime: ${animeName} (ID: ${animeId})`);

            // Rate limiting
            await sleep(DELAY_MS);

            const characters = await fetchCharactersForAnime(animeId);
            console.log(`fetched ${characters.length} characters for ${animeName}...`);

            const filteredCharacters = characters.filter((c) => c.favorites > MIN_FAVORITES);
            console.log(`Processing ${filteredCharacters.length} characters (favorites > ${MIN_FAVORITES}) for ${animeName}...`);

            for (const charData of filteredCharacters) {
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

            console.log(`Successfully seeded ${animeName}!\n`);

        } catch (error) {
            console.error(`Error processing ${animeName}:`, error);
            // Continue to next anime
        }
    }

    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
