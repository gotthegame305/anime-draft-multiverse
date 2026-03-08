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
                return (prisma as any).staticCharacter.upsert({
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
                        favorites: char.favorites,
                        winRate: char.winRate,
                        captain: char.captain,
                        viceCaptain: char.viceCaptain,
                        tank: char.tank,
                        duelist: char.duelist,
                        support: char.support,
                        aura: char.aura,
                        traitor: char.traitor,
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

    } catch (error: any) {
        console.error('Seeding error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Unknown error occurred during seeding' 
        }, { status: 500 });
    }
}
