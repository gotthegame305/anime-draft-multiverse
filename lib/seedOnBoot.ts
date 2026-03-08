import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

interface StaticCharacter {
    name: string;
    series: string;
    favorites: number;
    winRate: number;
    captain: number;
    viceCaptain: number;
    tank: number;
    duelist: number;
    support: number;
    aura: number;
    traitor: number;
}

export async function seedOnBoot() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const count = await (prisma as any).staticCharacter.count();

        if (count > 0) {
            console.log(`✅ Database already seeded with ${count} characters`);
            return;
        }

        console.log('🌱 Seeding database on boot...');

        const filePath = path.join(process.cwd(), 'scripts', 'static-characters.json');

        if (!fs.existsSync(filePath)) {
            console.warn('⚠️ static-characters.json not found, skipping seed.');
            return;
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const characters: StaticCharacter[] = JSON.parse(fileContent);

        const batchSize = 100;
        for (let i = 0; i < characters.length; i += batchSize) {
            const batch = characters.slice(i, i + batchSize);
            await Promise.all(batch.map((char: StaticCharacter) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (prisma as any).staticCharacter.upsert({
                    where: { name: char.name },
                    update: {
                        favorites:   char.favorites,
                        winRate:     char.winRate,
                        captain:     char.captain,
                        viceCaptain: char.viceCaptain,
                        tank:        char.tank,
                        duelist:     char.duelist,
                        support:     char.support,
                        aura:        char.aura,
                        traitor:     char.traitor,
                    },
                    create: {
                        name:        char.name,
                        series:      char.series,
                        favorites:   char.favorites,
                        winRate:     char.winRate,
                        captain:     char.captain,
                        viceCaptain: char.viceCaptain,
                        tank:        char.tank,
                        duelist:     char.duelist,
                        support:     char.support,
                        aura:        char.aura,
                        traitor:     char.traitor,
                    },
                })
            ));
        }

        console.log(`✅ Seeded ${characters.length} characters`);
    } catch (error) {
        console.error('❌ Seed error:', error);
    }
}