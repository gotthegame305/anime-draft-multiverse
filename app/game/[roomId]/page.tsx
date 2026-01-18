'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';
import MultiplayerGame from '@/components/MultiplayerGame';

interface Player {
    userId: string;
    isSpectator: boolean;
}

export default function GamePage({ params }: { params: { roomId: string } }) {
    const { data: session } = useSession();
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchRoom() {
            try {
                const res = await fetch(`/api/rooms/${params.roomId}/state`);
                const room = await res.json();

                if (res.ok) {
                    setPlayers(room.players.map((p: { userId: string; isSpectator: boolean; joinedAt: string }) => ({
                        userId: p.userId,
                        isSpectator: p.isSpectator,
                        joinedAt: p.joinedAt
                    })));
                }
            } catch {
                console.error('Failed to load room');
            } finally {
                setLoading(false);
            }
        }

        fetchRoom();
    }, [params.roomId]);

    if (!session?.user?.id) {
        redirect('/api/auth/signin');
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-2xl">Loading...</div>
            </div>
        );
    }

    return (
        <MultiplayerGame
            roomId={params.roomId}
            userId={session.user.id}
            players={players}
        />
    );
}
