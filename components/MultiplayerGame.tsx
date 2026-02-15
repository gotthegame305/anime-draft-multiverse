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
    status: 'SETUP' | 'DRAFTING' | 'GRADING' | 'FINISHED';
    selectedUniverses: string[];
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
const MIN_POOL_SIZE = 10;

export default function MultiplayerGame({ roomId, userId, players }: {
    roomId: string;
    userId: string;
    players: Array<{ userId: string; isSpectator: boolean; joinedAt: string }>;
}) {
    const router = useRouter();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    // IMPORTANT: Don't sort! Use the same order as the server for currentTurn to work correctly!
    // The server's currentTurn index corresponds to the original players array order
    const activePlayers = players.filter(p => !p.isSpectator);

    const normUserId = userId.toLowerCase().trim();
    const myPlayerIndex = activePlayers.findIndex(p => p.userId.toLowerCase().trim() === normUserId);
    const isSpectator = players.find(p => p.userId.toLowerCase().trim() === normUserId)?.isSpectator ?? true;
    const isMyTurn = !isSpectator && gameState?.currentTurn === myPlayerIndex;
    const isHost = gameState?.hostId === userId;

    const [characterPool, setCharacterPool] = useState<CharacterItem[]>([]);
    const [availableUniverses, setAvailableUniverses] = useState<string[]>([]);
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

    const getNormalizedPlayerKey = useCallback((keys: string[], targetUserId: string) => {
        const normTarget = targetUserId.toLowerCase().trim();
        return keys.find(k => k.toLowerCase().trim() === normTarget) || targetUserId;
    }, []);

    const getRolePower = (char: CharacterItem | null, roleIndex: number) => {
        if (!char) return { total: 0, base: 0, stars: 0 };
        const roleKey = ROLE_KEYS[roleIndex];
        const stars = Number(char.stats?.roleStats?.[roleKey]) || 1;
        const base = Math.log(Number(char.stats?.favorites) || 100);
        return { total: base + (stars * 3), base, stars };
    };

        const calculateWinner = useCallback(async (finalState: GameState) => {
        const scores: { [userId: string]: number } = {};
        const totalPowerByPlayer: { [userId: string]: number } = {};
        const logs: string[] = [];
        const playerIds = Object.keys(finalState.playerTeams);

        playerIds.forEach((playerId) => {
            scores[playerId] = 0;
            totalPowerByPlayer[playerId] = 0;
        });

        for (let roleIndex = 0; roleIndex < ROLES.length; roleIndex++) {
            const roleName = ROLES[roleIndex];
            logs.push(`${roleName} ROUND:`);

            const roleScores = playerIds.map((playerId) => {
                const team = finalState.playerTeams[playerId] || [];
                const char = team[roleIndex];
                const { total, base, stars } = getRolePower(char || null, roleIndex);
                totalPowerByPlayer[playerId] += total;
                return { playerId, char, total, base, stars };
            });

            roleScores.forEach(({ playerId, char, total, base, stars }) => {
                const playerName = activePlayers.find(p => p.userId === playerId)?.userId || playerId;
                if (!char) {
                    logs.push(`  - ${playerName}: EMPTY SLOT`);
                    return;
                }
                logs.push(`  - ${playerName}: ${char.name} | Pwr ${base.toFixed(1)} + (${stars}*3) = ${total.toFixed(1)}`);
            });

            const topScore = Math.max(...roleScores.map(r => r.total));
            const winners = roleScores.filter(r => r.total === topScore && r.total > 0);
            winners.forEach((winner) => {
                scores[winner.playerId] += 1;
            });

            if (winners.length > 0) {
                const winnerNames = winners
                    .map(w => activePlayers.find(p => p.userId === w.playerId)?.userId || w.playerId)
                    .join(', ');
                logs.push(`  -> Role Winner${winners.length > 1 ? 's' : ''}: ${winnerNames}`);
            } else {
                logs.push('  -> No winner for this role');
            }
        }

        logs.push('FINAL ROLE SCOREBOARD:');
        playerIds.forEach((playerId) => {
            const playerName = activePlayers.find(p => p.userId === playerId)?.userId || playerId;
            logs.push(`  ${playerName}: ${scores[playerId]} role points | Total power ${totalPowerByPlayer[playerId].toFixed(1)}`);
        });

        const winnerId = [...playerIds].sort((a, b) => {
            if (scores[b] !== scores[a]) return scores[b] - scores[a];
            return totalPowerByPlayer[b] - totalPowerByPlayer[a];
        })[0];

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
            const universes = Array.from(new Set(chars.map(c => c.animeUniverse))).sort();
            setAvailableUniverses(universes);

            try {
                const res = await fetch(`/api/rooms/${roomId}/state`);
                const roomData = await res.json();

                console.log('[GAME INIT] Room data:', roomData);

                if (roomData.gameState) {
                    console.log('[GAME INIT] Loading existing game state');
                    const hydratedState: GameState = {
                        ...roomData.gameState,
                        status: roomData.gameState.status || 'SETUP',
                        selectedUniverses: roomData.gameState.selectedUniverses || universes,                    };
                    setGameState(hydratedState);
                    setLoading(false);
                } else if (roomData.hostId === userId) {
                    console.log('[GAME INIT] Initializing game as host');
                    const initialState: GameState = {
                        currentTurn: 0,
                        round: 1,
                        playerTeams: {},
                        skipsRemaining: {},
                        currentDraw: null,
                        status: 'SETUP',
                        selectedUniverses: universes,
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
                            const hydratedState: GameState = {
                                ...d.gameState,
                                status: d.gameState.status || 'SETUP',
                                selectedUniverses: d.gameState.selectedUniverses || universes,                            };
                            setGameState(hydratedState);
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
        
        if (!gameState || gameState.status !== 'DRAFTING' || !isMyTurn || gameState.currentDraw || characterPool.length === 0) {
            console.warn('[DRAW] Blocked - conditions not met');
            return;
        }

        const available = characterPool.filter(c => {
            if (!gameState.selectedUniverses.includes(c.animeUniverse)) return false;
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
        if (!gameState || gameState.status !== 'DRAFTING' || !isMyTurn || !gameState.currentDraw) return;
        
        const myKey = getNormalizedPlayerKey(Object.keys(gameState.playerTeams), userId);
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
        if (!gameState || gameState.status !== 'DRAFTING' || !isMyTurn || !gameState.currentDraw) {
            console.warn('[PLACE CHAR] Rejected - gameState:', !!gameState, 'isMyTurn:', isMyTurn, 'hasDraw:', !!gameState?.currentDraw);
            return;
        }

        console.log('[PLACE CHAR] Placing character at slot:', slotIndex, 'char:', gameState.currentDraw.name);

        const newTeams = { ...gameState.playerTeams };
        const myKey = getNormalizedPlayerKey(Object.keys(newTeams), userId);

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

    const toggleUniverse = (universe: string) => {
        if (!gameState || !isHost || gameState.status !== 'SETUP') return;
        const selected = gameState.selectedUniverses.includes(universe)
            ? gameState.selectedUniverses.filter(u => u !== universe)
            : [...gameState.selectedUniverses, universe];
        const newState: GameState = { ...gameState, selectedUniverses: selected };
        setGameState(newState);
        syncState(newState);
    };

    const selectAllUniverses = () => {
        if (!gameState || !isHost || gameState.status !== 'SETUP') return;
        const newState: GameState = { ...gameState, selectedUniverses: availableUniverses };
        setGameState(newState);
        syncState(newState);
    };

    const deselectAllUniverses = () => {
        if (!gameState || !isHost || gameState.status !== 'SETUP') return;
        const newState: GameState = { ...gameState, selectedUniverses: [] };
        setGameState(newState);
        syncState(newState);
    };

    const startDraft = () => {
        if (!gameState || !isHost || gameState.status !== 'SETUP') return;
        const filteredCount = characterPool.filter(c => gameState.selectedUniverses.includes(c.animeUniverse)).length;
        if (gameState.selectedUniverses.length === 0) return;
        if (filteredCount < MIN_POOL_SIZE) return;
        const newState: GameState = {
            ...gameState,
            status: 'DRAFTING',
            currentTurn: 0,
            round: 1,
            currentDraw: null,
        };
        setGameState(newState);
        syncState(newState);
    };

    if (loading || !gameState) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-2xl">Starting game...</div>
            </div>
        );
    }

    if (gameState.status === 'SETUP') {
        const filteredCount = characterPool.filter(c => gameState.selectedUniverses.includes(c.animeUniverse)).length;
        const canStartDraft = gameState.selectedUniverses.length > 0 && filteredCount >= MIN_POOL_SIZE;

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-5xl bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl p-8">
                    <h1 className="text-4xl font-black text-white text-center mb-2">SETUP YOUR DECK</h1>
                    <p className="text-slate-400 text-center mb-8">Host chooses universes for this multiplayer draft pool.</p>

                    <div className="flex justify-center gap-4 mb-6">
                        <button
                            onClick={selectAllUniverses}
                            disabled={!isHost}
                            className="text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-blue-300 px-4 py-2 rounded"
                        >
                            Select All
                        </button>
                        <button
                            onClick={deselectAllUniverses}
                            disabled={!isHost}
                            className="text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-red-300 px-4 py-2 rounded"
                        >
                            Deselect All
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10 max-h-[420px] overflow-y-auto pr-2">
                        {availableUniverses.map(universe => {
                            const selected = gameState.selectedUniverses.includes(universe);
                            return (
                                <button
                                    key={universe}
                                    onClick={() => toggleUniverse(universe)}
                                    disabled={!isHost}
                                    className={`text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between ${selected ? 'bg-blue-900/30 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-slate-950 border-slate-800 opacity-70'} ${isHost ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                >
                                    <span className="font-bold text-white truncate">{universe}</span>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selected ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`}>
                                        {selected && <span className="text-white text-xs">+</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex justify-center flex-col items-center gap-2">
                        {isHost ? (
                            <button
                                onClick={startDraft}
                                disabled={!canStartDraft}
                                className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-2xl py-4 px-12 rounded-full shadow-[0_0_30px_rgba(250,204,21,0.5)]"
                            >
                                ENTER THE DRAFT
                            </button>
                        ) : (
                            <div className="text-slate-300 text-lg">Waiting for host to lock deck and start...</div>
                        )}
                        <span className="text-slate-500 text-sm">
                            {gameState.selectedUniverses.length} Universes Selected ({filteredCount} Characters)
                        </span>
                        {!canStartDraft && isHost && (
                            <span className="text-red-300 text-sm">
                                Select at least 1 universe and keep at least {MIN_POOL_SIZE} characters in pool.
                            </span>
                        )}
                    </div>
                </div>
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
                                    <p className="text-2xl font-bold mb-4 text-center text-orange-400">{score} role points</p>
                                    <div className="grid grid-cols-5 gap-2 mb-4">
                                        {team.map((char, idx) => (
                                            <div key={idx} className="relative h-24 rounded-lg overflow-hidden border border-slate-600">
                                                {char ? (
                                                    <>
                                                        <Image src={char.imageUrl} alt={char.name} fill className="object-cover" />
                                                        <div className="absolute top-1 right-1 bg-black/50 rounded px-1 text-[10px] text-yellow-300">
                                                            {'*'.repeat(Number(char.stats?.roleStats?.[ROLE_KEYS[idx]]) || 1)}
                                                        </div>
                                                    </>
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

                    {gameState.results?.logs && (
                        <div className="bg-black/40 border border-slate-700 rounded-xl p-4 mb-8 max-h-72 overflow-y-auto font-mono text-sm space-y-1">
                            {gameState.results.logs.map((log, i) => (
                                <div key={`${log}-${i}`} className="text-slate-200">{log}</div>
                            ))}
                        </div>
                    )}

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
            <div className="flex-1 overflow-y-auto">
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
                                {gameState.currentDraw && (
                                    <>
                                        {/* Show drawn card in header */}
                                        <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg flex-1">
                                            <div className="relative w-16 h-20 rounded overflow-hidden flex-shrink-0">
                                                <Image
                                                    src={gameState.currentDraw.imageUrl}
                                                    alt={gameState.currentDraw.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-yellow-400 font-bold text-sm truncate">{gameState.currentDraw.name}</p>
                                                <p className="text-gray-400 text-xs">{gameState.currentDraw.animeUniverse}</p>
                                                <p className="text-yellow-300 text-xs mt-1">👆 Click a slot to place!</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={skipCard}
                                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-4 rounded-xl whitespace-nowrap"
                                        >
                                            SKIP ({gameState.skipsRemaining[getNormalizedPlayerKey(Object.keys(gameState.skipsRemaining), userId)] ?? 0})
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Player Teams Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    {activePlayers.map((player, playerIdx) => {
                        const myKey = getNormalizedPlayerKey(Object.keys(gameState.playerTeams), player.userId);
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
                                        
                                        const roleKey = ROLE_KEYS[slotIdx];
                                        const roleRating = char?.stats?.roleStats?.[roleKey] as number | undefined;
                                        
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
                                                {/* Role Label at top */}
                                                <div className="absolute top-1 right-1 z-10 flex flex-col items-end">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider px-1 bg-black/50 rounded">
                                                        {role.split(' ')[0]}
                                                    </span>
                                                    {/* Star Rating */}
                                                    {char && roleRating && (
                                                        <div className="text-yellow-400 text-xs mt-0.5 bg-black/50 px-1 rounded">
                                                            {'*'.repeat(roleRating)}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {char ? (
                                                    <>
                                                        <Image src={char.imageUrl} alt={char.name} fill className="object-cover" />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-1">
                                                            <p className="text-xs text-white font-bold truncate w-full drop-shadow-lg">{char.name}</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-700 to-slate-800">
                                                        <p className="text-gray-400 text-xs text-center font-semibold px-1">{role}</p>
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

            {/* REMOVED: Modal was blocking clicks on slots! Card shows in center area instead */}

        </div>
    );
}


