import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function seedOnBoot() {
    try {
        // Check if database already has characters
        const count = await prisma.staticCharacter.count();
        
        if (count > 0) {
            console.log(`✅ Database already seeded with ${count} characters`);
            return;
        }

        console.log('🌱 Seeding database on boot...');
        
        const filePath = path.join(process.cwd(), 'scripts', 'static-characters.json');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const characters = JSON.parse(fileContent);

        // Batch insert all characters
        const batchSize = 100;
        for (let i = 0; i < characters.length; i += batchSize) {
            const batch = characters.slice(i, i + batchSize);
            
            await Promise.all(batch.map((char: any) =>
                prisma.staticCharacter.upsert({
                    where: { name: char.name },
                    update: {
                        favorites: char.favorites,
                        winRate: char.winRate,
                        captain: char.captain,
                        viceCaptain: char.viceCaptain,
                        tank: char.tank,
                        duelist: char.duelist,
                        support: char.support,
                        aura: char.aura,
                        traitor: char.traitor,
                    },
                    create: {
                        name: char.name,
                        series: char.series,
                        favorites: char.favorites,
                        winRate: char.winRate,
                        captain: char.captain,
                        viceCaptain: char.viceCaptain,
                        tank: char.tank,
                        duelist: char.duelist,
                        support: char.support,
                        aura: char.aura,
                        traitor: char.traitor,
                    },
                })
            ));
        }

        console.log(`✅ Seeded ${characters.length} characters`);
    } catch (error) {
        console.error('❌ Seed error:', error);
    }
}