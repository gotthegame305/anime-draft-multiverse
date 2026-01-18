
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const chars = await prisma.character.findMany({
            where: {
                OR: [
                    { name: { contains: "Senju" } },
                    { name: { contains: "Pain" } },
                    { name: { contains: "Jiraiya" } },
                    { name: { contains: "Kisame" } },
                    { name: { contains: "Hinata" } }
                ]
            }
        });
        console.log("--- DB CHECK ---");
        chars.forEach(c => console.log(`"${c.name}"`));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
