import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    // Simple security check
    if (secret !== 'anime123') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
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
