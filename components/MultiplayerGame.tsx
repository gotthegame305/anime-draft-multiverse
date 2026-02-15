'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { subscribeToRoom, unsubscribeFromRoom } from '@/lib/pusher-client';
import { getCharacters, CharacterItem } from '@/app/actions';

interface GameState {
    currentTurn: number;
    round: number;
    playerTeams: { [userId: string]: (CharacterItem | null)[] };
    skipsRemaining: { [userId: string]: number };
    currentDraw: CharacterItem | null;
    status: 'DRAFTING' | 'GRADING' | 'FINISHED';
    results?: {
        winnerId: string;
        scores: { [userId: string]: number };
        logs: string[];
    };
    hostId?: string;
}

const ROLES = ['CAPTAIN', 'VICE CAPTAIN', 'TANK', 'DUELIST', 'SUPPORT'];
const ROLE_KEYS = ['captain', 'viceCaptain', 'tank', 'duelist', 'support'] as const;
const INITIAL_SKIPS = 2;
const IMPACT_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3';

export default function MultiplayerGame({ roomId, userId, players }: {
    roomId: string;
    userId: string;
    players: Array<{ userId: string; isSpectator: boolean; joinedAt: string }>;
}) {
    const router = useRouter();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [chatOpen, setChatOpen] = useState(true);
    const [chatMessages, setChatMessages] = useState<Array<{ user: string; text: string; timestamp: string }>>([]);
    const [chatInput, setChatInput] = useState('');

    // IMPORTANT: Don't sort! Use the same order as the server for currentTurn to work correctly!
    // The server's currentTurn index corresponds to the original players array order
    const activePlayers = players.filter(p => !p.isSpectator);

    const normUserId = userId.toLowerCase().trim();
    const myPlayerIndex = activePlayers.findIndex(p => p.userId.toLowerCase().trim() === normUserId);
    const isSpectator = players.find(p => p.userId.toLowerCase().trim() === normUserId)?.isSpectator ?? true;
    const isMyTurn = !isSpectator && gameState?.currentTurn === myPlayerIndex;

    const [characterPool, setCharacterPool] = useState<CharacterItem[]>([]);
    const [syncTimeout, setSyncTimeout] = useState<NodeJS.Timeout | null>(null);

    const playImpactSound = () => {
        if (isMuted) return;
        try {
            const audio = new Audio(IMPACT_SOUND_URL);
            audio.volume = 0.3;
            audio.play().catch(e => console.error("Audio play failed:", e));
        } catch (error) {
            console.error("Audio error:", error);
        }
    };

    const syncState = useCallback(async (state: GameState) => {
        if (syncTimeout) clearTimeout(syncTimeout);
        
        const timeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/rooms/${roomId}/state`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'updateState', 
                        data: state,
                        userId: userId
                    })
                });

                if (!res.ok && process.env.NODE_ENV === 'development') {
                    const error = await res.json();
                    console.error('[SYNC STATE ERROR]', error);
                }
            } catch (err) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('[SYNC STATE FETCH ERROR]', err);
                }
            }
        }, 300);
        
        setSyncTimeout(timeout);
    }, [roomId, userId, syncTimeout]);

    const calculateWinner = useCallback(async (finalState: GameState) => {
        const scores: { [userId: string]: number } = {};
        const logs: string[] = [];

        Object.entries(finalState.playerTeams).forEach(([playerId, team]) => {
            let score = 0;
            const playerName = activePlayers.find(p => p.userId === playerId)?.userId || playerId;
            logs.push(`--- ${playerName}'s Squad Evaluation ---`);

            team.forEach((char, idx) => {
                if (!char) return;
                const roleKey = ROLE_KEYS[idx] as keyof typeof char.stats.roleStats;
                const roleRating = (char.stats.roleStats[roleKey] as number) || 1;
                const favorites = Number(char.stats.favorites) || 100;
                const base = Math.log(favorites);
                const roleBonus = roleRating * 3;
                const total = base + roleBonus;

                score += total;
                logs.push(`${ROLES[idx]}: ${char.name} | Base ${base.toFixed(1)} + ${roleRating}⭐ bonus = ${total.toFixed(1)}`);
            });
            scores[playerId] = score;
            logs.push(`Total Score: ${score.toFixed(1)}`);
        });

        const winnerEntry = Object.entries(scores).reduce((a, b) =>
            scores[a[0]] > scores[b[0]] ? a : b
        );
        const winnerId = winnerEntry[0];

        const newState: GameState = {
            ...finalState,
            status: 'FINISHED',
            results: {
                winnerId,
                scores,
                logs
            }
        };

        setGameState(newState);

        await fetch(`/api/rooms/${roomId}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'end', 
                data: newState,
                userId: userId
            })
        });
    }, [roomId, activePlayers, userId]);

    useEffect(() => {
        async function init() {
            const chars = await getCharacters(500);
            setCharacterPool(chars);

            try {
                const res = await fetch(`/api/rooms/${roomId}/state`);
                const roomData = await res.json();

                console.log('[GAME INIT] Room data:', roomData);

                if (roomData.gameState) {
                    console.log('[GAME INIT] Loading existing game state');
                    setGameState(roomData.gameState);
                    setLoading(false);
                } else if (roomData.hostId === userId) {
                    console.log('[GAME INIT] Initializing game as host');
                    const initialState: GameState = {
                        currentTurn: 0,
                        round: 1,
                        playerTeams: {},
                        skipsRemaining: {},
                        currentDraw: null,
                        status: 'DRAFTING',
                        hostId: userId
                    };

                    activePlayers.forEach(p => {
                        initialState.playerTeams[p.userId] = [null, null, null, null, null];
                        initialState.skipsRemaining[p.userId] = INITIAL_SKIPS;
                    });

                    console.log('[GAME INIT] Initial state:', initialState);

                    setGameState(initialState);
                    setLoading(false);
                    syncState(initialState);
                } else {
                    console.log('[GAME INIT] Waiting for host to initialize');
                    const poll = setInterval(async () => {
                        const r = await fetch(`/api/rooms/${roomId}/state`);
                        const d = await r.json();
                        if (d.gameState) {
                            console.log('[GAME INIT] Game state loaded from host');
                            setGameState(d.gameState);
                            setLoading(false);
                            clearInterval(poll);
                        }
                    }, 2000);
                    return () => clearInterval(poll);
                }
            } catch (error) {
                console.error('[GAME INIT] Failed to initialize:', error);
            }
        }

        init();

        const channel = subscribeToRoom(roomId);
        channel?.bind('state-updated', (data: Partial<GameState>) => {
            console.log("[GAME DEBUG] Pusher: state-updated", data);
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
        console.log('[DRAW] Checking conditions:', {
            hasGameState: !!gameState,
            isMyTurn,
            hasCurrentDraw: !!gameState?.currentDraw,
            poolLength: characterPool.length,
            myPlayerIndex,
            normUserId,
            players: activePlayers.map(p => p.userId)
        });
        
        if (!gameState || !isMyTurn || gameState.currentDraw || characterPool.length === 0) {
            console.warn('[DRAW] Blocked - conditions not met');
            return;
        }

        const available = characterPool.filter(c => {
            return !Object.values(gameState.playerTeams).some(team =>
                team.some(slot => slot?.id === c.id)
            );
        });

        if (available.length === 0) return;

        const randomChar = available[Math.floor(Math.random() * available.length)];
        playImpactSound();
        
        // When you draw, it's STILL your turn - you need to place the card
        // Don't advance turn on draw, only on place or skip
        const newState = { ...gameState, currentDraw: randomChar };
        console.log('[DRAW] Drew character:', randomChar.name, '- Your turn to place!');
        setGameState(newState);
        syncState(newState);
    };

    const skipCard = () => {
        if (!gameState || !isMyTurn || !gameState.currentDraw) return;
        
        const myKey = Object.keys(gameState.playerTeams).find(k => k.toLowerCase().trim() === normUserId) || userId;
        const skipsLeft = gameState.skipsRemaining[myKey] || 0;

        if (skipsLeft <= 0) return;

        // Move to next turn
        const nextTurn = (gameState.currentTurn + 1) % activePlayers.length;
        const nextRound = gameState.round;

        const newSkips = { ...gameState.skipsRemaining };
        newSkips[myKey] = skipsLeft - 1;

        const newState: GameState = {
            ...gameState,
            currentDraw: null,
            currentTurn: nextTurn,
            round: nextRound,
            skipsRemaining: newSkips,
            status: nextRound > 5 ? 'FINISHED' : 'DRAFTING'
        };

        setGameState(newState);
        syncState(newState);

        if (newState.status === 'FINISHED') {
            calculateWinner(newState);
        }
    };

    const placeCharacter = (slotIndex: number) => {
        if (!gameState || !isMyTurn || !gameState.currentDraw) {
            console.warn('[PLACE CHAR] Rejected - gameState:', !!gameState, 'isMyTurn:', isMyTurn, 'hasDraw:', !!gameState?.currentDraw);
            return;
        }

        console.log('[PLACE CHAR] Placing character at slot:', slotIndex, 'char:', gameState.currentDraw.name);

        const newTeams = { ...gameState.playerTeams };
        const myKey = Object.keys(newTeams).find(k => k.toLowerCase().trim() === normUserId) || userId;

        console.log('[PLACE CHAR] myKey:', myKey, 'normUserId:', normUserId, 'userId:', userId);

        if (!newTeams[myKey]) {
            newTeams[myKey] = [null, null, null, null, null];
        }

        const myTeam = [...newTeams[myKey]];
        myTeam[slotIndex] = gameState.currentDraw;
        newTeams[myKey] = myTeam;

        const nextTurn = (gameState.currentTurn + 1) % activePlayers.length;
        const totalPlaced = Object.values(newTeams).reduce((acc, team) =>
            acc + team.filter(slot => slot !== null).length, 0
        );

        const nextRound = gameState.round + (totalPlaced % activePlayers.length === 0 ? 1 : 0);

        const newState: GameState = {
            ...gameState,
            currentDraw: null,
            currentTurn: nextTurn,
            round: nextRound,
            playerTeams: newTeams,
            status: nextRound > 5 ? 'FINISHED' : 'DRAFTING',
        };

        console.log('[PLACE CHAR] New state:', { round: newState.round, turn: newState.currentTurn, status: newState.status });

        setGameState(newState);
        syncState(newState);

        if (newState.status === 'FINISHED') {
            calculateWinner(newState);
        }
    };

    const addChatMessage = () => {
        if (!chatInput.trim()) return;
        const newMessage = {
            user: userId,
            text: chatInput,
            timestamp: new Date().toLocaleTimeString()
        };
        setChatMessages(prev => [...prev, newMessage]);
        setChatInput('');
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
                <div className="max-w-4xl w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8">
                    <h1 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                        Game Over!
                    </h1>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        {Object.entries(gameState.playerTeams).map(([playerId, team]) => {
                            const playerName = activePlayers.find(p => p.userId === playerId)?.userId || playerId;
                            const score = gameState.results?.scores[playerId] || 0;
                            const isWinner = gameState.results?.winnerId === playerId;

                            return (
                                <div key={playerId} className={`p-6 rounded-xl border-2 ${isWinner ? 'border-yellow-400 bg-yellow-400/10' : 'border-slate-600 bg-slate-700/30'}`}>
                                    <h3 className={`text-xl font-bold mb-4 ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
                                        {playerName} {isWinner && '👑'}
                                    </h3>
                                    <p className="text-2xl font-bold mb-4 text-center text-orange-400">{score.toFixed(1)}</p>
                                    <div className="grid grid-cols-5 gap-2 mb-4">
                                        {team.map((char, idx) => (
                                            <div key={idx} className="relative h-24 rounded-lg overflow-hidden border border-slate-600">
                                                {char ? (
                                                    <Image src={char.imageUrl} alt={char.name} fill className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-600/30" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => router.push('/lobby')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl"
                    >
                        Back to Lobby
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex gap-4 p-4">
            {/* Main Game Area */}
            <div className={`flex-1 overflow-y-auto ${chatOpen ? 'md:pr-4' : ''}`}>
                {/* Header */}
                <div className="mb-4 space-y-2">
                    {isSpectator && (
                        <div className="bg-indigo-600/30 border border-indigo-400 text-indigo-200 px-4 py-2 rounded-lg text-center font-bold animate-pulse">
                            👀 SPECTATOR MODE
                        </div>
                    )}
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <p className="text-gray-400 text-sm">Round {gameState.round}/5</p>
                                <p className="text-white font-bold text-lg">
                                    {isMyTurn ? "🟢 YOUR TURN!" : `⏳ Player ${gameState.currentTurn + 1}'s Turn`}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsMuted(!isMuted)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
                            >
                                {isMuted ? '🔇 Unmute' : '🔊 Mute'}
                            </button>
                        </div>

                        {isMyTurn && (
                            <div className="flex gap-2">
                                {!gameState.currentDraw && (
                                    <button
                                        onClick={drawCharacter}
                                        className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-xl animate-pulse"
                                    >
                                        DRAW CHARACTER
                                    </button>
                                )}
                                {gameState.currentDraw && gameState.skipsRemaining[userId] > 0 && (
                                    <button
                                        onClick={skipCard}
                                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl"
                                    >
                                        SKIP ({gameState.skipsRemaining[userId]} left)
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Player Teams Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    {activePlayers.map((player, playerIdx) => {
                        const myKey = Object.keys(gameState.playerTeams).find(k => k.toLowerCase().trim() === player.userId.toLowerCase().trim()) || player.userId;
                        const team = gameState.playerTeams[myKey] || [];
                        const isActive = gameState.currentTurn === playerIdx;
                        const playerSkips = gameState.skipsRemaining[myKey] || INITIAL_SKIPS;

                        return (
                            <div
                                key={player.userId}
                                className={`bg-slate-800/30 border-2 rounded-xl p-4 transition-all ${isActive ? 'border-yellow-400 shadow-lg shadow-yellow-400/50' : 'border-slate-700'}`}
                            >
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-white font-bold">
                                        Player {playerIdx + 1}
                                        {player.userId === userId && ' (You)'}
                                        {isActive && ' 🎯'}
                                    </h3>
                                    <p className="text-sm text-gray-400">Skip: {playerSkips}/{INITIAL_SKIPS}</p>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    {ROLES.map((role, slotIdx) => {
                                        const char = team[slotIdx];
                                        const canPlace = isMyTurn && gameState.currentDraw && !char;
                                        
                                        return (
                                            <div
                                                key={slotIdx}
                                                onClick={() => {
                                                    if (canPlace) {
                                                        placeCharacter(slotIdx);
                                                    }
                                                }}
                                                className={`relative h-32 rounded-lg border-2 overflow-hidden transition-all cursor-pointer ${
                                                    char ? 'border-blue-500' : 'border-dashed border-slate-600'
                                                } ${canPlace ? 'hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-400/50' : ''}`}
                                                title={char?.name || role}
                                                role="button"
                                                tabIndex={canPlace ? 0 : -1}
                                            >
                                                {char ? (
                                                    <>
                                                        <Image src={char.imageUrl} alt={char.name} fill className="object-cover" />
                                                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-all flex items-end p-1">
                                                            <p className="text-xs text-white font-bold truncate w-full">{char.name}</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-700 to-slate-800">
                                                        <p className="text-gray-400 text-xs text-center font-semibold">{role}</p>
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
            </div>

            {/* Current Draw (Modal) */}
            {gameState.currentDraw && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 pointer-events-none md:pointer-events-auto">
                    <div className="bg-slate-800 border-4 border-yellow-400 rounded-2xl p-6 max-w-sm w-full mx-4 pointer-events-auto shadow-2xl">
                        <div className="relative w-full h-64 mb-4 rounded-xl overflow-hidden">
                            <Image
                                src={gameState.currentDraw.imageUrl}
                                alt={gameState.currentDraw.name}
                                fill
                                className="object-cover"
                            />
                        </div>
                        <h3 className="text-white text-2xl font-bold mb-2">{gameState.currentDraw.name}</h3>
                        <p className="text-gray-400 mb-4">{gameState.currentDraw.animeUniverse}</p>
                        {isMyTurn && (
                            <p className="text-yellow-400 text-center font-semibold">Click a team slot to place this character!</p>
                        )}
                    </div>
                </div>
            )}

            {/* Chat Sidebar */}
            <div className={`${chatOpen ? 'w-80' : 'w-16'} transition-all hidden md:flex flex-col bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden`}>
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 className={`font-bold text-white ${chatOpen ? '' : 'hidden'}`}>💬 Chat</h3>
                    <button
                        onClick={() => setChatOpen(!chatOpen)}
                        className="text-gray-400 hover:text-white"
                    >
                        {chatOpen ? '◀' : '▶'}
                    </button>
                </div>

                {chatOpen && (
                    <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {chatMessages.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center">No messages yet...</p>
                            ) : (
                                chatMessages.map((msg, idx) => (
                                    <div key={idx} className="text-sm">
                                        <p className="text-blue-400 font-semibold">{msg.user === userId ? 'You' : msg.user}</p>
                                        <p className="text-gray-300">{msg.text}</p>
                                        <p className="text-xs text-gray-600">{msg.timestamp}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-700 flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addChatMessage()}
                                placeholder="Message..."
                                className="flex-1 bg-slate-700 text-white rounded px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={addChatMessage}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 font-bold"
                            >
                                ▶
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
