import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    const jsonPath = path.join(__dirname, 'static-characters.json');
    console.log(`Reading JSON file from: ${jsonPath}`);

    if (!fs.existsSync(jsonPath)) {
        console.error("Failed to find static-characters.json. Did you run the extract script?");
        process.exit(1);
    }

    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    const characters = JSON.parse(fileContent);

    console.log(`Found ${characters.length} characters in the JSON file. Ready to seed...`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const char of characters) {
        try {
            await prisma.staticCharacter.upsert({
                where: { name: char.name },
                update: char,
                create: char
            });
            updatedCount++;
        } catch (e) {
            console.error(`Failed to upsert character ${char.name}:`, e);
        }

        if ((updatedCount + createdCount) % 50 === 0) {
            console.log(`Processed ${updatedCount + createdCount} characters...`);
        }
    }

    console.log(`\nSeed Complete! Upserted ${updatedCount} StaticCharacters.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
