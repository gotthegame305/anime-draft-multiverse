import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const type = searchParams.get('type') || 'static';

    // Auth check — set ADMIN_SEED_SECRET in your .env
    if (secret !== process.env.ADMIN_SEED_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const filePath = path.join(process.cwd(), 'scripts', 'static-characters.json');

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({
                error: 'static-characters.json not found. Run `npm run seed:generate` locally first, then deploy.'
            }, { status: 500 });
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const characters: any[] = JSON.parse(fileContent);

        // Force reset — clears table before re-seeding
        if (type === 'reset') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).staticCharacter.deleteMany();
        }

        // Upsert all characters in batches of 100
        let seeded = 0;
        const batchSize = 100;
        for (let i = 0; i < characters.length; i += batchSize) {
            const batch = characters.slice(i, i + batchSize);
            await Promise.all(batch.map((char) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (prisma as any).staticCharacter.upsert({
                    where: { name: char.name },
                    update: {
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
            seeded += batch.length;
        }

        return NextResponse.json({
            message: `✅ Successfully seeded ${seeded} characters (type: ${type})`
        });

    } catch (error) {
        console.error('Admin seed error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
