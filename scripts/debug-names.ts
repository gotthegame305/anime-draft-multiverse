
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const chars = await prisma.character.findMany({
            take: 50,
            orderBy: { stats: 'desc' } // Top favorites
        });
        console.log("--- TOP 50 NAMES IN DB ---");
        chars.forEach(c => console.log(`"${c.name}" (Universe: ${c.animeUniverse})`));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
