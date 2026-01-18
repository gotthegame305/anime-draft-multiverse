import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
    try {
        const messages = await prisma.chatMessage.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: {
                sender: {
                    select: {
                        name: true,
                        image: true,
                        avatarUrl: true,
                    }
                }
            }
        });

        return NextResponse.json(messages.reverse());
    } catch (error) {
        console.error("Error fetching messages:", error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { content } = await req.json();
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
        }

        const message = await prisma.chatMessage.create({
            data: {
                content: content.trim(),
                senderId: session.user.id,
            },
            include: {
                sender: {
                    select: {
                        name: true,
                        image: true,
                        avatarUrl: true
                    }
                }
            }
        });

        return NextResponse.json(message);
    } catch (error) {
        console.error("Error sending message:", error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}
