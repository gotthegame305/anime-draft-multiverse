'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import MultiplayerGame from '@/components/MultiplayerGame';

interface Player {
    userId: string;
    isSpectator: boolean;
    joinedAt: string;
}

export default function GamePage({ params }: { params: { roomId: string } }) {
    const { data: session } = useSession();
    const [userId, setUserId] = useState<string | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Set user ID from session or localStorage
        if (session?.user?.id) {
            setUserId(session.user.id);
        } else {
            let anonId = localStorage.getItem('anonUserId');
            if (!anonId) {
                anonId = `anon_${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem('anonUserId', anonId);
            }
            setUserId(anonId);
        }
    }, [session]);

    useEffect(() => {
        if (!userId) return;

        async function fetchRoom() {
            try {
                const res = await fetch(`/api/rooms/${params.roomId}/state?t=${Date.now()}`, {
                    cache: 'no-store'
                });
                const room = await res.json();

                if (res.ok && room.players) {
                    setPlayers(room.players.map((p: { userId: string; isSpectator: boolean; joinedAt: string }) => ({
                        userId: p.userId,
                        isSpectator: p.isSpectator,
                        joinedAt: p.joinedAt
                    })));
                }
            } catch (err) {
                console.error('[GAME PAGE] Failed to load room:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchRoom();
    }, [params.roomId, userId]);

    if (!userId || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-2xl">Loading game...</div>
            </div>
        );
    }

    return (
        <MultiplayerGame
            roomId={params.roomId}
            userId={userId}
            players={players}
        />
    );
}
