
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    try {
        const filePath = path.join(__dirname, 'scored-characters.json');
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const scores = JSON.parse(rawData);

        console.log(`Loaded ${scores.length} AI scores. Applying to database...`);

        for (const item of scores) {
            // Find character by name (fuzzy match or exact)
            // Using exact name match for simplicity as names usually match Jikan
            // In a real app we might use ID, but we don't know IDs ahead of time here.

            // Try updating
            const result = await prisma.character.updateMany({
                where: {
                    name: {
                        contains: item.name,
                        mode: 'insensitive'
                    }
                },
                data: {
                    roleRatings: item.roleRatings
                }
            });

            if (result.count > 0) {
                console.log(`✅ Updated ${item.name} (Matches: ${result.count})`);
            } else {
                console.log(`⚠️  Character not found: ${item.name}`);
            }
        }

        console.log("Score update complete.");

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
