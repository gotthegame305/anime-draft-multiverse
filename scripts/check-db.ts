
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.character.count();
        console.log(`\n\n[DIAGNOSTIC] Total Characters in DB: ${count}`);

        if (count > 0) {
            const sample = await prisma.character.findFirst();
            console.log('[DIAGNOSTIC] Sample Character:', sample?.name);
        } else {
            console.error('[DIAGNOSTIC] DATABASE IS EMPTY! Seeding failed or connected to wrong DB.');
        }
    } catch (e) {
        console.error('[DIAGNOSTIC] Connection Failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
