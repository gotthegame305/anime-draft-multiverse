'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeToRoom, unsubscribeFromRoom } from '@/lib/pusher-client';

interface Player {
    id: string;
    userId: string;
    isSpectator: boolean;
    joinedAt: string;
}

interface Room {
    id: string;
    code: string;
    hostId: string;
    status: string;
    players: Player[];
    maxPlayers: number;
}

export default function RoomLobby({ roomId, userId }: { roomId: string; userId: string }) {
    const router = useRouter();
    const [room, setRoom] = useState<Room | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Fetch initial room state
        async function fetchRoom() {
            try {
                const res = await fetch(`/api/rooms/${roomId}/state`);
                const data = await res.json();

                if (res.ok) {
                    setRoom(data);
                } else {
                    setError(data.error || 'Room not found');
                }
            } catch (err) {
                setError('Failed to load room');
            } finally {
                setLoading(false);
            }
        }

        fetchRoom();

        // Subscribe to real-time updates
        const channel = subscribeToRoom(roomId);

        channel.bind('player-joined', () => {
            fetchRoom(); // Refresh room state
        });

        channel.bind('player-left', () => {
            fetchRoom();
        });

        channel.bind('game-started', () => {
            router.push(`/game/${roomId}`);
        });

        return () => {
            unsubscribeFromRoom(roomId);
        };
    }, [roomId, router]);

    const handleStartGame = async () => {
        try {
            const res = await fetch(`/api/rooms/${roomId}/state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start' })
            });

            if (res.ok) {
                router.push(`/game/${roomId}`);
            }
        } catch (err) {
            setError('Failed to start game');
        }
    };

    const handleLeaveRoom = async () => {
        try {
            await fetch(`/api/rooms/${roomId}/state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'leave' })
            });
        } catch (err) {
            console.error('Failed to leave room:', err);
        }
        router.push('/lobby');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-2xl">Loading room...</div>
            </div>
        );
    }

    if (error || !room) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-red-500/20 border border-red-500 rounded-2xl p-8 text-center">
                    <p className="text-red-300 text-xl mb-4">{error}</p>
                    <button
                        onClick={() => router.push('/lobby')}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-xl"
                    >
                        Back to Lobby
                    </button>
                </div>
            </div>
        );
    }

    const isHost = room.hostId === userId;
    const activePlayers = room.players.filter(p => !p.isSpectator);
    const spectators = room.players.filter(p => p.isSpectator);
    const canStart = isHost && activePlayers.length >= 2 && activePlayers.length <= 4;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white mb-2">Game Lobby</h1>
                    <div className="inline-block bg-blue-600 px-8 py-3 rounded-xl">
                        <p className="text-gray-300 text-sm">Room Code</p>
                        <p className="text-white text-3xl font-mono font-bold tracking-widest">{room.code}</p>
                    </div>
                </div>

                {/* Players */}
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-6">
                    <h2 className="text-2xl font-bold text-white mb-4">
                        Players ({activePlayers.length}/{room.maxPlayers || 4})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {activePlayers.map((player, idx) => (
                            <div
                                key={player.id}
                                className="bg-slate-900/50 border border-slate-600 rounded-xl p-4 flex items-center gap-3"
                            >
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                    {idx + 1}
                                </div>
                                <div className="flex-1">
                                    <p className="text-white font-semibold">Player {idx + 1}</p>
                                    {player.userId === room.hostId && (
                                        <p className="text-yellow-400 text-sm">👑 Host</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Spectators */}
                {spectators.length > 0 && (
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-gray-300 mb-3">
                            Spectators ({spectators.length})
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {spectators.map((spec) => (
                                <div key={spec.id} className="bg-slate-700 px-3 py-1 rounded-full text-sm text-gray-300">
                                    Spectator
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-4">
                    <button
                        onClick={handleLeaveRoom}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-6 rounded-xl transition-all"
                    >
                        Leave Room
                    </button>
                    {isHost && (
                        <button
                            onClick={handleStartGame}
                            disabled={!canStart}
                            className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95"
                        >
                            {canStart ? 'Start Game!' : `Need 2-4 Players (${activePlayers.length}/4)`}
                        </button>
                    )}
                    {!isHost && (
                        <div className="flex-1 bg-slate-800 border border-slate-600 flex items-center justify-center rounded-xl p-4">
                            <p className="text-gray-400">Waiting for host to start...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
