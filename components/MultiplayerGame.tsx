'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { subscribeToRoom, unsubscribeFromRoom } from '@/lib/pusher-client';
import { getCharacters, CharacterItem } from '@/app/actions';

interface GameState {
    currentTurn: number; // Player index 0-3
    round: number; // 1-5
    playerTeams: { [userId: string]: (CharacterItem | null)[] };
    currentDraw: CharacterItem | null;
    status: 'DRAFTING' | 'GRADING' | 'FINISHED';
    // characterPool is removed from shared state to save bandwidth/DB limits
}

const ROLES = ['CAPTAIN', 'VICE CAPTAIN', 'TANK', 'DUELIST', 'SUPPORT'];
const ROLE_KEYS = ['captain', 'viceCaptain', 'tank', 'duelist', 'support'] as const;

export default function MultiplayerGame({ roomId, userId, players }: {
    roomId: string;
    userId: string;
    players: Array<{ userId: string; isSpectator: boolean; joinedAt: string }>;
}) {
    const router = useRouter();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [loading, setLoading] = useState(true);

    const sortedPlayers = [...players].sort((a, b) => {
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });
    const activePlayers = sortedPlayers.filter(p => !p.isSpectator);

    // Robust ID comparison (normalize both to avoid mismatch)
    const normUserId = userId.toLowerCase().trim();
    const myPlayerIndex = activePlayers.findIndex(p => p.userId.toLowerCase().trim() === normUserId);
    const isSpectator = sortedPlayers.find(p => p.userId.toLowerCase().trim() === normUserId)?.isSpectator ?? true;
    const isMyTurn = !isSpectator && gameState?.currentTurn === myPlayerIndex;

    console.log("[LOBBY DEBUG] Turn Check:", {
        roomId,
        userId: normUserId,
        foundIndex: myPlayerIndex,
        activeIds: activePlayers.map(p => p.userId.toLowerCase().trim()),
        currentTurn: gameState?.currentTurn,
        isMyTurn,
        isSpectator
    });

    const [characterPool, setCharacterPool] = useState<CharacterItem[]>([]);

    const syncState = useCallback(async (state: GameState) => {
        await fetch(`/api/rooms/${roomId}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateState', data: state })
        });
    }, [roomId]);

    const calculateWinner = useCallback(async (finalState: GameState) => {
        // Calculate scores for each player
        const scores: { [userId: string]: number } = {};

        Object.entries(finalState.playerTeams).forEach(([playerId, team]) => {
            let score = 0;
            team.forEach((char, idx) => {
                if (!char) return;
                const roleKey = ROLE_KEYS[idx] as keyof typeof char.stats.roleStats;
                const roleRating = (char.stats.roleStats[roleKey] as number) || 1;
                const favorites = Number(char.stats.favorites) || 100;
                const base = Math.log(favorites);
                score += base + (roleRating * 3);
            });
            scores[playerId] = score;
        });

        // Find winner
        const winnerId = Object.entries(scores).reduce((a, b) =>
            scores[a[0]] > scores[b[0]] ? a : b
        )[0];

        await fetch(`/api/rooms/${roomId}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'end', data: { winnerId, scores } })
        });
    }, [roomId]);

    useEffect(() => {
        async function init() {
            // Load character pool locally once
            const chars = await getCharacters(500);
            setCharacterPool(chars);

            try {
                const res = await fetch(`/api/rooms/${roomId}/state`);
                const roomData = await res.json();

                if (roomData.gameState) {
                    setGameState(roomData.gameState);
                    setLoading(false);
                } else if (roomData.hostId === userId) {
                    // Host initializes if state is missing
                    const initialState: GameState = {
                        currentTurn: 0,
                        round: 1,
                        playerTeams: {},
                        currentDraw: null,
                        status: 'DRAFTING',
                    };

                    activePlayers.forEach(p => {
                        initialState.playerTeams[p.userId] = [null, null, null, null, null];
                    });

                    setGameState(initialState);
                    setLoading(false);
                    syncState(initialState);
                } else {
                    // Wait for host to initialize
                    const poll = setInterval(async () => {
                        const r = await fetch(`/api/rooms/${roomId}/state`);
                        const d = await r.json();
                        if (d.gameState) {
                            setGameState(d.gameState);
                            setLoading(false);
                            clearInterval(poll);
                        }
                    }, 2000);
                    return () => clearInterval(poll);
                }
            } catch (error) {
                console.error('Failed to initialize game state:', error);
            }
        }

        init();

        const channel = subscribeToRoom(roomId);
        channel?.bind('state-updated', (data: Partial<GameState>) => {
            console.log("[LOBBY DEBUG] Pusher: state-updated", data);
            setGameState(prev => {
                if (!prev) return data as GameState;
                return {
                    ...prev,
                    ...data
                } as GameState;
            });
            setLoading(false);
        });

        return () => {
            unsubscribeFromRoom(roomId);
        };
    }, [roomId, userId, activePlayers, syncState]);

    const drawCharacter = () => {
        if (!gameState || !isMyTurn || gameState.currentDraw || characterPool.length === 0) return;

        const available = characterPool.filter(c => {
            // Check if character already drafted by anyone
            return !Object.values(gameState.playerTeams).some(team =>
                team.some(slot => slot?.id === c.id)
            );
        });

        if (available.length === 0) return;

        const randomChar = available[Math.floor(Math.random() * available.length)];
        const newState = { ...gameState, currentDraw: randomChar };
        setGameState(newState);
        syncState(newState);
    };

    const placeCharacter = (slotIndex: number) => {
        if (!gameState || !isMyTurn || !gameState.currentDraw) {
            console.warn("[LOBBY DEBUG] Place rejected:", { hasState: !!gameState, isMyTurn, hasDraw: !!gameState?.currentDraw });
            return;
        }

        // Ensure current player has a team array (Self-Repair)
        const newTeams = { ...gameState.playerTeams };
        const myKey = Object.keys(newTeams).find(k => k.toLowerCase().trim() === normUserId) || userId;

        if (!newTeams[myKey]) {
            newTeams[myKey] = [null, null, null, null, null];
        }

        const myTeam = [...newTeams[myKey]];
        myTeam[slotIndex] = gameState.currentDraw;
        newTeams[myKey] = myTeam;

        // Move to next turn
        const nextTurn = (gameState.currentTurn + 1) % activePlayers.length;
        let nextRound = gameState.round;

        // Check if round is complete (everyone has placed for this slot index in logic? 
        // No, usually round is when everyone has had a turn to place ANY character)
        const totalPlaced = Object.values(newTeams).reduce((acc, team) =>
            acc + team.filter(slot => slot !== null).length, 0
        );

        // If everyone has placed their char for the current round
        if (totalPlaced % activePlayers.length === 0) {
            nextRound++;
        }

        const newState: GameState = {
            ...gameState,
            currentDraw: null,
            currentTurn: nextTurn,
            round: nextRound,
            playerTeams: newTeams,
            status: nextRound > 5 ? 'FINISHED' : 'DRAFTING',
        };

        setGameState(newState);
        syncState(newState);

        // End game if all rounds complete
        if (newState.status === 'FINISHED') {
            calculateWinner(newState);
        }
    };


    if (loading || !gameState) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-2xl">Starting game...</div>
            </div>
        );
    }

    if (gameState.status === 'FINISHED') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
                <div className="max-w-2xl w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 text-center">
                    <h1 className="text-4xl font-bold text-white mb-8">Game Over!</h1>
                    <button
                        onClick={() => router.push('/lobby')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl"
                    >
                        Back to Lobby
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-4 space-y-2">
                {isSpectator && (
                    <div className="bg-indigo-600/30 border border-indigo-400 text-indigo-200 px-4 py-2 rounded-lg text-center font-bold animate-pulse">
                        👀 SPECTATOR MODE - Watching the draft...
                    </div>
                )}
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-4 flex justify-between items-center">
                    <div>
                        <p className="text-gray-400 text-sm">Round {gameState.round}/5</p>
                        <p className="text-white font-bold text-xl">
                            {isMyTurn ? "🟢 IT'S YOUR TURN!" : `⏳ Player ${gameState.currentTurn + 1}'s Turn`}
                        </p>
                    </div>
                    {isMyTurn && !gameState.currentDraw && (
                        <button
                            onClick={drawCharacter}
                            className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-xl animate-pulse"
                        >
                            DRAW CHARACTER
                        </button>
                    )}
                </div>
            </div>

            {/* 4-Player Grid (2x2) */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activePlayers.map((player, playerIdx) => {
                    // Normalize key lookup to match placeCharacter logic
                    const myKey = Object.keys(gameState.playerTeams).find(k => k.toLowerCase().trim() === player.userId.toLowerCase().trim()) || player.userId;
                    const team = gameState.playerTeams[myKey] || [];
                    const isActive = gameState.currentTurn === playerIdx;

                    return (
                        <div
                            key={player.userId}
                            className={`bg-slate-800/30 border-2 rounded-xl p-4 transition-all ${isActive ? 'border-yellow-400 shadow-lg shadow-yellow-400/50' : 'border-slate-700'
                                }`}
                        >
                            <h3 className="text-white font-bold mb-2">
                                Player {playerIdx + 1}
                                {player.userId === userId && ' (You)'}
                                {isActive && ' - ACTIVE'}
                            </h3>
                            <div className="grid grid-cols-5 gap-2">
                                {ROLES.map((role, slotIdx) => {
                                    const char = team[slotIdx];
                                    return (
                                        <div
                                            key={slotIdx}
                                            onClick={() => isMyTurn && gameState.currentDraw && placeCharacter(slotIdx)}
                                            className={`relative h-32 rounded-lg border-2 overflow-hidden ${char ? 'border-blue-500' : 'border-dashed border-slate-600'
                                                } ${isMyTurn && gameState.currentDraw && !char ? 'cursor-pointer hover:border-yellow-400' : ''
                                                }`}
                                        >
                                            {char ? (
                                                <Image src={char.imageUrl} alt={char.name} fill className="object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full">
                                                    <p className="text-gray-500 text-xs text-center">{role}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Current Draw (Center) - pointer-events-none to allow clicking slots behind it */}
            {gameState.currentDraw && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 pointer-events-none">
                    <div className="bg-slate-800 border-4 border-yellow-400 rounded-2xl p-6 max-w-sm w-full mx-4 pointer-events-auto transform scale-90 sm:scale-100 shadow-2xl">
                        <div className="relative w-full h-64 mb-4">
                            <Image
                                src={gameState.currentDraw.imageUrl}
                                alt={gameState.currentDraw.name}
                                fill
                                className="object-cover rounded-xl"
                            />
                        </div>
                        <h3 className="text-white text-2xl font-bold mb-2">{gameState.currentDraw.name}</h3>
                        <p className="text-gray-400 mb-4">{gameState.currentDraw.animeUniverse}</p>
                        {isMyTurn && (
                            <p className="text-yellow-400 text-center">Click a slot to place this character!</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
