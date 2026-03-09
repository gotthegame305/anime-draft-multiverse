'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { pusherClient, subscribeToRoom, unsubscribeFromRoom } from '@/lib/pusher-client';
import { getCharacters, CharacterItem } from '@/app/actions';
import { GAME_CONFIG, BASE_ROLES, ROLE_DISPLAY_NAMES, RoleKey } from '@/lib/gameConfig';
import { simulateMatchup, simulateMultiplayerMatchup, type ScoreBreakdown } from '@/lib/battleEngine';

const { initialSkips: INITIAL_SKIPS, minPoolSize: MIN_POOL_SIZE, turnTimeoutMs: TURN_TIMEOUT_MS, impactSoundUrl: IMPACT_SOUND_URL } = GAME_CONFIG;

function formatBreakdownSummary(breakdown?: ScoreBreakdown | null) {
    if (!breakdown) return 'combat 0 | stars 0 | universe 0 | fit 0 | sweep 0';
    return `combat ${breakdown.combatPoints} | stars ${breakdown.rawStarPoints} | universe ${breakdown.universeBonusPoints} | fit ${breakdown.bestRolePoints} | sweep ${breakdown.starSweepPoints}`;
}

interface GameState {
    currentTurn: number;
    round: number;
    playerTeams: { [userId: string]: (CharacterItem | null)[] };
    skipsRemaining: { [userId: string]: number };
    currentDraw: CharacterItem | null;
    status: 'SETUP' | 'DRAFTING' | 'GRADING' | 'FINISHED';
    selectedUniverses: string[];
    activeRoles?: RoleKey[];
    results?: {
        winnerId: string;
        scores: { [userId: string]: number };
        logs: string[];
        breakdowns: { [userId: string]: ScoreBreakdown };
    } | null;
    hostId?: string;
}

export default function MultiplayerGame({
    roomId,
    userId,
    players,
    playerNames = {},
}: {
    roomId: string;
    userId: string;
    players: Array<{ userId: string; isSpectator: boolean; joinedAt: string }>;
    playerNames?: Record<string, string>;
}) {
    const router = useRouter();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [pusherError, setPusherError] = useState(!pusherClient);
    // Turn timer countdown (seconds remaining, null when not active)
    const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);

    // IMPORTANT: Don't sort! Use the same order as the server for currentTurn to work correctly!
    const activePlayers = useMemo(
        () => players.filter(p => !p.isSpectator),
        [players]
    );

    const normUserId = userId.toLowerCase().trim();
    const myPlayerIndex = activePlayers.findIndex(p => p.userId.toLowerCase().trim() === normUserId);
    const isSpectator = players.find(p => p.userId.toLowerCase().trim() === normUserId)?.isSpectator ?? true;
    const isMyTurn = !isSpectator && gameState?.currentTurn === myPlayerIndex;
    const isHost = gameState?.hostId === userId;

    const [characterPool, setCharacterPool] = useState<CharacterItem[]>([]);
    const [availableUniverses, setAvailableUniverses] = useState<string[]>([]);
    const [leavingToLobby, setLeavingToLobby] = useState(false);
    const winnerCalcInFlight = useRef(false);
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSyncedPayloadRef = useRef<string>('');
    const turnTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Helper: get a display name for a userId  
    const getDisplayName = useCallback((uid: string, index?: number) => {
        if (playerNames[uid]) return playerNames[uid];
        if (index !== undefined) return `Player ${index + 1}`;
        const idx = activePlayers.findIndex(p => p.userId === uid);
        return idx >= 0 ? `Player ${idx + 1}` : uid.slice(0, 8);
    }, [playerNames, activePlayers]);

    const playImpactSound = useCallback(() => {
        if (isMuted) return;
        try {
            const audio = new Audio(IMPACT_SOUND_URL);
            audio.volume = 0.3;
            audio.play().catch(() => { /* silent fail */ });
        } catch {
            // silent fail
        }
    }, [isMuted]);

    const syncState = useCallback(async (state: GameState) => {
        const payload = JSON.stringify({
            action: 'updateState',
            data: state,
            userId
        });
        if (payload === lastSyncedPayloadRef.current) return;
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

        const timeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/rooms/${roomId}/state`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload
                });
                if (!res.ok && process.env.NODE_ENV === 'development') {
                    const error = await res.json();
                    console.error('[SYNC STATE ERROR]', error);
                }
                lastSyncedPayloadRef.current = payload;
            } catch (err) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('[SYNC STATE FETCH ERROR]', err);
                }
            }
        }, 1000);
        syncTimeoutRef.current = timeout;
    }, [roomId, userId]);

    const getNormalizedPlayerKey = useCallback((keys: string[], targetUserId: string) => {
        const normTarget = targetUserId.toLowerCase().trim();
        return keys.find(k => k.toLowerCase().trim() === normTarget) || targetUserId;
    }, []);

    const getAvailableCharacters = useCallback((state: GameState, excludeId?: number) => {
        return characterPool.filter((character) => {
            if (!state.selectedUniverses.includes(character.animeUniverse)) return false;
            if (excludeId !== undefined && character.id === excludeId) return false;

            return !Object.values(state.playerTeams).some((team) =>
                team.some((slot) => slot?.id === character.id)
            );
        });
    }, [characterPool]);

    const getBestSlotIndex = useCallback((team: (CharacterItem | null)[], roles: RoleKey[], character: CharacterItem) => {
        const emptySlots = team
            .map((slot, index) => (slot === null ? index : -1))
            .filter((index) => index !== -1);

        if (emptySlots.length === 0) return -1;

        emptySlots.sort((a, b) => {
            const roleA = roles[a];
            const roleB = roles[b];
            const scoreA = Number(character.stats?.roleStats?.[roleA] || 0);
            const scoreB = Number(character.stats?.roleStats?.[roleB] || 0);

            if (scoreA !== scoreB) return scoreB - scoreA;
            return a - b;
        });

        return emptySlots[0];
    }, []);

    const buildPlacedState = useCallback((
        state: GameState,
        targetUserId: string,
        character: CharacterItem,
        slotIndex: number
    ) => {
        const newTeams = { ...state.playerTeams };
        const playerKey = getNormalizedPlayerKey(Object.keys(newTeams), targetUserId);
        const roles = state.activeRoles || [...BASE_ROLES] as RoleKey[];

        if (!newTeams[playerKey]) {
            newTeams[playerKey] = new Array(roles.length).fill(null);
        }

        const updatedTeam = [...newTeams[playerKey]];
        updatedTeam[slotIndex] = character;
        newTeams[playerKey] = updatedTeam;

        const totalPlaced = Object.values(newTeams).reduce((acc, team) =>
            acc + team.filter((slot) => slot !== null).length, 0
        );
        const totalSlots = activePlayers.length * roles.length;
        const isDraftComplete = totalPlaced >= totalSlots;
        const completedRounds = Math.floor(totalPlaced / activePlayers.length);
        const nextRound = isDraftComplete
            ? roles.length
            : Math.min(roles.length, completedRounds + 1);

        return {
            ...state,
            currentDraw: null,
            currentTurn: (state.currentTurn + 1) % activePlayers.length,
            round: nextRound,
            playerTeams: newTeams,
            status: isDraftComplete ? 'FINISHED' as const : 'DRAFTING' as const,
        };
    }, [activePlayers.length, getNormalizedPlayerKey]);

    const calculateWinner = useCallback(async (finalState: GameState) => {
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
        }

        const roles = finalState.activeRoles || [...BASE_ROLES] as RoleKey[];
        const playerIds = activePlayers.map((player) => player.userId);

        if (playerIds.length < 2) {
            // Edge case: Solo or bug
            return;
        }

        const normalizedTeams = Object.fromEntries(
            playerIds.map((playerId) => {
                const teamKey = getNormalizedPlayerKey(Object.keys(finalState.playerTeams), playerId);
                return [playerId, finalState.playerTeams[teamKey] || new Array(roles.length).fill(null)];
            })
        ) as { [userId: string]: (CharacterItem | null)[] };

        const teamNames = Object.fromEntries(
            playerIds.map((playerId) => [playerId, getDisplayName(playerId)])
        ) as { [userId: string]: string };

        let winnerId: string;
        let scores: { [userId: string]: number };
        let logs: string[];
        let breakdowns: { [userId: string]: ScoreBreakdown };

        if (playerIds.length === 2) {
            const [p1, p2] = playerIds;
            const teamA = normalizedTeams[p1];
            const teamB = normalizedTeams[p2];
            const nameA = teamNames[p1];
            const nameB = teamNames[p2];
            const result = simulateMatchup(teamA, teamB, roles, nameA, nameB);

            scores = {
                [p1]: result.userScore,
                [p2]: result.cpuScore
            };
            winnerId = result.isWin ? p1 : p2;
            logs = result.logs;
            breakdowns = {
                [p1]: result.userBreakdown,
                [p2]: result.cpuBreakdown
            };
        } else {
            const result = simulateMultiplayerMatchup(normalizedTeams, roles, teamNames);
            winnerId = result.winnerId;
            scores = result.scores;
            logs = result.logs;
            breakdowns = result.breakdowns;
        }

        const newState: GameState = {
            ...finalState,
            status: 'FINISHED',
            results: { winnerId, scores, logs, breakdowns }
        };

        setGameState(newState);

        await fetch(`/api/rooms/${roomId}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'end', data: newState, userId })
        });
    }, [roomId, getDisplayName, userId, activePlayers, getNormalizedPlayerKey]);

    // ---  Turn Timer ---
    useEffect(() => {
        if (turnTimerRef.current) clearInterval(turnTimerRef.current);

        if (!isMyTurn || gameState?.status !== 'DRAFTING') {
            setTurnSecondsLeft(null);
            return;
        }

        const totalSeconds = Math.floor(TURN_TIMEOUT_MS / 1000);
        setTurnSecondsLeft(totalSeconds);

        turnTimerRef.current = setInterval(() => {
            setTurnSecondsLeft(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(turnTimerRef.current!);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

        const autoPlaceTimer = setTimeout(() => {
            if (!gameState) return;

            const activePlayer = activePlayers[gameState.currentTurn];
            if (!activePlayer) return;

            const roles = gameState.activeRoles || [...BASE_ROLES] as RoleKey[];
            const playerKey = getNormalizedPlayerKey(Object.keys(gameState.playerTeams), activePlayer.userId);
            const playerTeam = gameState.playerTeams[playerKey] || new Array(roles.length).fill(null);
            const timedOutCard = gameState.currentDraw
                || getAvailableCharacters(gameState)[Math.floor(Math.random() * getAvailableCharacters(gameState).length)];

            if (!timedOutCard) return;

            const bestSlotIndex = getBestSlotIndex(playerTeam, roles, timedOutCard);
            if (bestSlotIndex === -1) return;

            const newState = buildPlacedState(gameState, activePlayer.userId, timedOutCard, bestSlotIndex);
            setGameState(newState);

            if (newState.status === 'FINISHED') {
                void calculateWinner(newState);
            } else {
                syncState(newState);
            }
        }, TURN_TIMEOUT_MS);

        return () => {
            clearInterval(turnTimerRef.current!);
            clearTimeout(autoPlaceTimer);
        };
    }, [isMyTurn, gameState?.status, gameState?.currentTurn, activePlayers, gameState, getAvailableCharacters, getBestSlotIndex, getNormalizedPlayerKey, buildPlacedState, syncState, calculateWinner]);

    useEffect(() => {
        async function init() {
            const chars = await getCharacters(500);
            setCharacterPool(chars);
            const universes = Array.from(new Set(chars.map(c => c.animeUniverse))).sort();
            setAvailableUniverses(universes);

            try {
                const res = await fetch(`/api/rooms/${roomId}/state`);
                const roomData = await res.json();

                const hasGameState = roomData.gameState && Object.keys(roomData.gameState).length > 0;

                if (hasGameState) {
                    const hydratedState: GameState = {
                        ...roomData.gameState,
                        status: roomData.gameState.status || 'SETUP',
                        selectedUniverses: roomData.gameState.selectedUniverses || universes,
                    };
                    setGameState(hydratedState);
                    setLoading(false);
                } else if ((roomData.status === 'WAITING' || roomData.status === 'DRAFTING') && roomData.hostId === userId) {
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

                    setGameState(initialState);
                    setLoading(false);
                    syncState(initialState);
                } else {
                    const poll = setInterval(async () => {
                        const r = await fetch(`/api/rooms/${roomId}/state`);
                        const d = await r.json();
                        if (d.gameState && Object.keys(d.gameState).length > 0) {
                            const hydratedState: GameState = {
                                ...d.gameState,
                                status: d.gameState.status || 'SETUP',
                                selectedUniverses: d.gameState.selectedUniverses || universes,
                            };
                            setGameState(hydratedState);
                            setLoading(false);
                            clearInterval(poll);
                        }
                    }, 5000);
                    return () => clearInterval(poll);
                }
            } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('[GAME INIT] Failed to initialize:', error);
                }
            }
        }

        init();

        const channel = subscribeToRoom(roomId);
        channel?.bind('state-updated', (data: Partial<GameState>) => {
            setGameState(prev => {
                if (!prev) return data as GameState;
                if (data.status === 'FINISHED' && data.results === undefined && prev.results) {
                    return { ...prev, ...data, results: prev.results } as GameState;
                }
                return { ...prev, ...data } as GameState;
            });
            setLoading(false);
        });

        channel?.bind('game-ended', (data: GameState) => {
            setGameState(data);
            setLoading(false);
        });

        return () => { unsubscribeFromRoom(roomId); };
    }, [roomId, userId, activePlayers, syncState]);

    const drawCharacter = () => {
        if (!gameState || gameState.status !== 'DRAFTING' || !isMyTurn || gameState.currentDraw || characterPool.length === 0) return;

        const available = getAvailableCharacters(gameState);

        if (available.length === 0) return;

        const randomChar = available[Math.floor(Math.random() * available.length)];
        playImpactSound();
        const newState = { ...gameState, currentDraw: randomChar };
        setGameState(newState);
        syncState(newState);
    };

    const skipCard = () => {
        if (!gameState || gameState.status !== 'DRAFTING' || !isMyTurn || !gameState.currentDraw) return;

        const myKey = getNormalizedPlayerKey(Object.keys(gameState.playerTeams), userId);
        const skipsLeft = gameState.skipsRemaining[myKey] || 0;
        if (skipsLeft <= 0) return;

        const available = getAvailableCharacters(gameState, gameState.currentDraw?.id);

        if (available.length === 0) return;

        const newSkips = { ...gameState.skipsRemaining };
        newSkips[myKey] = skipsLeft - 1;
        const randomChar = available[Math.floor(Math.random() * available.length)];
        playImpactSound();

        const newState: GameState = {
            ...gameState,
            currentDraw: randomChar,
            skipsRemaining: newSkips,
            status: 'DRAFTING'
        };
        setGameState(newState);
        syncState(newState);
    };

    const placeCharacter = (slotIndex: number) => {
        if (!gameState || gameState.status !== 'DRAFTING' || !isMyTurn || !gameState.currentDraw) return;
        const newState = buildPlacedState(gameState, userId, gameState.currentDraw, slotIndex);

        setGameState(newState);

        if (newState.status === 'FINISHED') {
            void calculateWinner(newState);
        } else {
            syncState(newState);
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

    const buildFreshDraftState = useCallback((baseState: GameState) => {
        const roll = Math.random();
        let modifier: 'aura' | 'traitor' | null = null;

        if (roll >= 0.5 && roll < 0.75) modifier = 'aura';
        if (roll >= 0.75) modifier = 'traitor';

        const roles = [...BASE_ROLES] as RoleKey[];
        if (modifier) roles.push(modifier);

        const freshTeams: GameState['playerTeams'] = {};
        const freshSkips: GameState['skipsRemaining'] = {};

        activePlayers.forEach((player) => {
            freshTeams[player.userId] = new Array(roles.length).fill(null);
            freshSkips[player.userId] = INITIAL_SKIPS;
        });

        return {
            ...baseState,
            status: 'DRAFTING' as const,
            currentTurn: 0,
            round: 1,
            currentDraw: null,
            activeRoles: roles,
            playerTeams: freshTeams,
            skipsRemaining: freshSkips,
            results: null,
        };
    }, [activePlayers]);

    const startDraft = () => {
        if (!gameState || !isHost || gameState.status !== 'SETUP') return;
        const filteredCount = characterPool.filter(c => gameState.selectedUniverses.includes(c.animeUniverse)).length;
        if (gameState.selectedUniverses.length === 0 || filteredCount < MIN_POOL_SIZE) return;
        const newState = buildFreshDraftState(gameState);
        setGameState(newState);
        syncState(newState);
    };

    const handleRematch = useCallback(async () => {
        if (!gameState || !isHost || gameState.status !== 'FINISHED') return;

        const filteredCount = characterPool.filter(c => gameState.selectedUniverses.includes(c.animeUniverse)).length;
        if (gameState.selectedUniverses.length === 0 || filteredCount < MIN_POOL_SIZE) return;

        const rematchState = buildFreshDraftState(gameState);
        setGameState(rematchState);

        await fetch(`/api/rooms/${roomId}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'rematch', data: rematchState, userId })
        });
    }, [buildFreshDraftState, characterPool, gameState, isHost, roomId, userId]);

    const goToLobby = useCallback(async () => {
        if (leavingToLobby) return;
        setLeavingToLobby(true);
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        unsubscribeFromRoom(roomId);

        try {
            await fetch(`/api/rooms/${roomId}/state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'leave', userId })
            });
        } catch {
            // Best effort; navigation should still proceed.
        }

        router.push('/lobby');
        setTimeout(() => {
            if (typeof window !== 'undefined' && window.location.pathname !== '/lobby') {
                window.location.assign('/lobby');
            }
        }, 900);
    }, [leavingToLobby, roomId, router, userId]);

    useEffect(() => {
        if (!gameState || gameState.status !== 'FINISHED' || gameState.results || !isHost) return;
        if (winnerCalcInFlight.current) return;
        winnerCalcInFlight.current = true;
        calculateWinner(gameState).finally(() => {
            winnerCalcInFlight.current = false;
        });
    }, [gameState, isHost, calculateWinner]);

    if (loading || !gameState) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-2xl">Starting game...</div>
            </div>
        );
    }

    // --- SETUP SCREEN ---
    if (gameState.status === 'SETUP') {
        const filteredCount = characterPool.filter(c => gameState.selectedUniverses.includes(c.animeUniverse)).length;
        const canStartDraft = gameState.selectedUniverses.length > 0 && filteredCount >= MIN_POOL_SIZE;

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
                {pusherError && (
                    <div className="fixed top-4 left-4 right-4 z-50 bg-yellow-500/20 border border-yellow-500/50 rounded-xl px-4 py-3 text-yellow-300 text-sm flex items-center justify-between">
                        ⚠️ Real-time connection unavailable — game updates may be delayed
                        <button onClick={() => setPusherError(false)} className="ml-4 text-yellow-400 hover:text-yellow-200 font-bold">✕</button>
                    </div>
                )}
                <div className="w-full max-w-5xl bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl p-8">
                    <h1 className="text-4xl font-black text-white text-center mb-2">SETUP YOUR DECK</h1>
                    <p className="text-slate-400 text-center mb-8">Host chooses universes for this multiplayer draft pool.</p>

                    <div className="flex justify-center gap-4 mb-6">
                        <button onClick={selectAllUniverses} disabled={!isHost} className="text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-blue-300 px-4 py-2 rounded">Select All</button>
                        <button onClick={deselectAllUniverses} disabled={!isHost} className="text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-red-300 px-4 py-2 rounded">Deselect All</button>
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

    // --- FINISHED SCREEN ---
    if (gameState.status === 'FINISHED') {
        const winnerName = gameState.results?.winnerId ? getDisplayName(gameState.results.winnerId) : 'Unknown';
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
                <div className="max-w-4xl w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8">
                    <h1 className="text-4xl font-bold text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                        Game Over!
                    </h1>
                    {gameState.results && (
                        <p className="text-center text-yellow-300 font-bold text-xl mb-8">
                            👑 Winner: {winnerName}
                        </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        {activePlayers.map((player, playerIdx) => {
                            const playerKey = getNormalizedPlayerKey(Object.keys(gameState.playerTeams), player.userId);
                            const team = gameState.playerTeams[playerKey] || [];
                            const name = getDisplayName(player.userId, playerIdx);
                            const score = gameState.results?.scores[player.userId] ?? gameState.results?.scores[playerKey] ?? 0;
                            const breakdown = gameState.results?.breakdowns[player.userId] ?? gameState.results?.breakdowns[playerKey] ?? null;
                            const isWinner = gameState.results?.winnerId === player.userId;

                            return (
                                <div key={player.userId} className={`p-6 rounded-xl border-2 ${isWinner ? 'border-yellow-400 bg-yellow-400/10' : 'border-slate-600 bg-slate-700/30'}`}>
                                    <h3 className={`text-xl font-bold mb-1 ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
                                        {name} {isWinner && '👑'}
                                    </h3>
                                    <p className="text-2xl font-bold text-center text-orange-400">{score} total points</p>
                                    <p className="text-xs text-center text-slate-300 mt-2 mb-4 leading-relaxed">{formatBreakdownSummary(breakdown)}</p>
                                    <div className="grid grid-cols-5 gap-2 mb-4">
                                        {team.map((char, idx) => (
                                            <div key={idx} className="relative h-24 rounded-lg overflow-hidden border border-slate-600">
                                                {char ? (
                                                    <>
                                                        <Image src={char.imageUrl} alt={char.name} fill className="object-cover" />
                                                        <div className="absolute top-1 right-1 bg-black/50 rounded px-1 text-[10px] text-yellow-300">
                                                            {'*'.repeat(Number(char.stats?.roleStats?.[gameState.activeRoles?.[idx] || BASE_ROLES[idx]]) || 1)}
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
                                <div
                                    key={`${log}-${i}`}
                                    className={`${
                                        log.includes('TOTAL SCORE') || log.includes('COMBAT SCORE')
                                            ? 'text-yellow-300 font-bold'
                                            : log.includes('BONUS SCORING') || log.includes('TIEBREAKER')
                                                ? 'text-purple-300'
                                                : 'text-slate-200'
                                    }`}
                                >
                                    {log}
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={() => { void goToLobby(); }}
                        disabled={leavingToLobby}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-xl"
                    >
                        {leavingToLobby ? 'Leaving...' : 'Back to Lobby'}
                    </button>
                    {isHost ? (
                        <button
                            onClick={() => { void handleRematch(); }}
                            disabled={leavingToLobby}
                            className="w-full mt-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-xl"
                        >
                            Start Rematch
                        </button>
                    ) : (
                        <div className="w-full mt-3 bg-slate-700/50 border border-slate-600 text-slate-300 font-medium py-4 px-8 rounded-xl text-center">
                            Waiting for host to start the rematch...
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- DRAFTING SCREEN ---
    const turnSeconds = TURN_TIMEOUT_MS / 1000;
    const timerPercent = turnSecondsLeft !== null ? (turnSecondsLeft / turnSeconds) * 100 : 100;
    const activePlayerName = activePlayers[gameState.currentTurn]
        ? getDisplayName(activePlayers[gameState.currentTurn].userId, gameState.currentTurn)
        : `Player ${gameState.currentTurn + 1}`;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex gap-4 p-4">
            {/* Pusher warning banner */}
            {pusherError && (
                <div className="fixed top-4 left-4 right-4 z-50 bg-yellow-500/20 border border-yellow-500/50 rounded-xl px-4 py-3 text-yellow-300 text-sm flex items-center justify-between">
                    ⚠️ Real-time connection unavailable — game updates may be delayed
                    <button onClick={() => setPusherError(false)} className="ml-4 text-yellow-400 hover:text-yellow-200 font-bold">✕</button>
                </div>
            )}

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
                                    {isMyTurn ? '🟢 YOUR TURN!' : `⏳ ${activePlayerName}'s Turn`}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsMuted(!isMuted)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
                            >
                                {isMuted ? '🔇 Unmute' : '🔊 Mute'}
                            </button>
                        </div>

                        {/* Turn Timer Bar — shown when it's your turn */}
                        {isMyTurn && turnSecondsLeft !== null && (
                            <div className="mb-3">
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>Time remaining</span>
                                    <span className={turnSecondsLeft <= 10 ? 'text-red-400 font-bold animate-pulse' : 'text-gray-300'}>
                                        {turnSecondsLeft}s
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${timerPercent > 50 ? 'bg-green-500' : timerPercent > 25 ? 'bg-yellow-400' : 'bg-red-500'}`}
                                        style={{ width: `${timerPercent}%` }}
                                    />
                                </div>
                            </div>
                        )}

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
                                        <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg flex-1">
                                            <div className="relative w-16 h-20 rounded overflow-hidden flex-shrink-0">
                                                <Image src={gameState.currentDraw.imageUrl} alt={gameState.currentDraw.name} fill className="object-cover" />
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
                                            REDRAW ({gameState.skipsRemaining[getNormalizedPlayerKey(Object.keys(gameState.skipsRemaining), userId)] ?? 0})
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Spectator: show current draw if one exists */}
                        {isSpectator && gameState.currentDraw && (
                            <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg mt-2">
                                <div className="relative w-12 h-16 rounded overflow-hidden flex-shrink-0">
                                    <Image src={gameState.currentDraw.imageUrl} alt={gameState.currentDraw.name} fill className="object-cover" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Active Draw</p>
                                    <p className="text-sm text-yellow-300 font-bold">{gameState.currentDraw.name}</p>
                                    <p className="text-xs text-slate-400">{gameState.currentDraw.animeUniverse}</p>
                                </div>
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
                        const displayName = getDisplayName(player.userId, playerIdx);

                        return (
                            <div
                                key={player.userId}
                                className={`bg-slate-800/30 border-2 rounded-xl p-4 transition-all ${isActive ? 'border-yellow-400 shadow-lg shadow-yellow-400/50' : 'border-slate-700'}`}
                            >
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-white font-bold">
                                        {displayName}
                                        {player.userId === userId && ' (You)'}
                                        {isActive && ' 🎯'}
                                    </h3>
                                    <p className="text-sm text-gray-400">Redraw: {playerSkips}/{INITIAL_SKIPS}</p>
                                </div>
                                {isActive && gameState.currentDraw && (
                                    <div className="mb-3 flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-lg p-2">
                                        <div className="relative w-12 h-16 rounded overflow-hidden flex-shrink-0">
                                            <Image src={gameState.currentDraw.imageUrl} alt={gameState.currentDraw.name} fill className="object-cover" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] uppercase tracking-wide text-slate-400">Current Draw</p>
                                            <p className="text-sm text-yellow-300 font-bold truncate">{gameState.currentDraw.name}</p>
                                            <p className="text-xs text-slate-400 truncate">{gameState.currentDraw.animeUniverse}</p>
                                        </div>
                                    </div>
                                )}
                                <div className={`grid ${gameState.activeRoles?.length === 6 ? 'grid-cols-6' : 'grid-cols-5'} gap-2`}>
                                    {(gameState.activeRoles || BASE_ROLES).map((roleKey, slotIdx) => {
                                        const role = ROLE_DISPLAY_NAMES[roleKey];
                                        const char = team[slotIdx];
                                        const canPlace = isMyTurn && !!gameState.currentDraw && !char && player.userId.toLowerCase().trim() === normUserId;
                                        const roleRating = char?.stats?.roleStats?.[roleKey] as number | undefined;

                                        return (
                                            <div
                                                key={slotIdx}
                                                onClick={() => { if (canPlace) placeCharacter(slotIdx); }}
                                                className={`relative h-32 rounded-lg border-2 overflow-hidden transition-all cursor-pointer ${char ? 'border-blue-500' : 'border-dashed border-slate-600'} ${canPlace ? 'hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-400/50' : ''}`}
                                                title={char?.name || role}
                                                role="button"
                                                tabIndex={canPlace ? 0 : -1}
                                            >
                                                <div className="absolute top-1 right-1 z-10 flex flex-col items-end">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider px-1 bg-black/50 rounded">
                                                        {role.split(' ')[0]}
                                                    </span>
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
        </div>
    );
}
