'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LobbyPage() {
    const router = useRouter();
    const [joinCode, setJoinCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        // Get or create anonymous user ID for consistent identification
        let anonId = localStorage.getItem('anonUserId');
        if (!anonId) {
            anonId = `anon_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('anonUserId', anonId);
        }
        setUserId(anonId);
    }, []);

    const handleCreateRoom = async () => {
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/rooms/create', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            const room = await res.json();

            if (res.ok) {
                router.push(`/room/${room.id}`);
            } else {
                setError(room.error || 'Failed to create room');
            }
        } catch {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim()) return;

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/rooms/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: joinCode.toUpperCase(), isSpectator: false, userId })
            });

            const room = await res.json();

            if (res.ok) {
                router.push(`/room/${room.id}`);
            } else {
                setError(room.error || 'Failed to join room');
            }
        } catch {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full space-y-8">
                {/* Title */}
                <div className="text-center">
                    <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-4">
                        ANIME DRAFT MULTIVERSE
                    </h1>
                    <p className="text-gray-300 text-xl">Multiplayer Mode</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-center">
                        <p className="text-red-300">{error}</p>
                    </div>
                )}

                {/* Create Room */}
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-bold text-white mb-4">Create New Game</h2>
                    <p className="text-gray-400 mb-6">Host a new game and invite your friends!</p>
                    <button
                        onClick={handleCreateRoom}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95"
                    >
                        {loading ? 'Creating...' : 'Create Room'}
                    </button>
                </div>

                {/* Join Room */}
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-bold text-white mb-4">Join Existing Game</h2>
                    <p className="text-gray-400 mb-6">Enter the 6-character room code</p>
                    <form onSubmit={handleJoinRoom} className="space-y-4">
                        <input
                            type="text"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            maxLength={6}
                            placeholder="ABC123"
                            className="w-full bg-slate-900 border border-slate-600 text-white text-center text-2xl font-mono tracking-widest rounded-xl p-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                        />
                        <button
                            type="submit"
                            disabled={loading || joinCode.length !== 6}
                            className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all"
                        >
                            {loading ? 'Joining...' : 'Join Room'}
                        </button>
                    </form>
                </div>

                {/* Back to Single Player */}
                <button
                    onClick={() => router.push('/draft')}
                    className="w-full text-gray-400 hover:text-white transition-colors text-center py-2"
                >
                    ← Back to Single Player
                </button>
            </div>
        </div>
    );
}
