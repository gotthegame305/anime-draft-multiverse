'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import CharacterCard from './CharacterCard';
import { getCharacters, submitMatch, CharacterItem, RoleStats } from '@/app/actions';

const ROLES = ['CAPTAIN', 'VICE CAPTAIN', 'TANK', 'DUELIST', 'SUPPORT'];
const ROLES_KEY: (keyof RoleStats)[] = ['captain', 'viceCaptain', 'tank', 'duelist', 'support'];
const MAX_SKIPS = 1;

export default function DraftGrid() {
    // Game State
    const [allCharacters, setAllCharacters] = useState<CharacterItem[]>([]);
    const [characterPool, setCharacterPool] = useState<CharacterItem[]>([]);

    // Filter State
    const [availableUniverses, setAvailableUniverses] = useState<string[]>([]);
    const [selectedUniverses, setSelectedUniverses] = useState<string[]>([]);

    // Using Array(5).fill(null) to ensure fixed slots
    const [userTeam, setUserTeam] = useState<(CharacterItem | null)[]>([null, null, null, null, null]);
    const [cpuTeam, setCpuTeam] = useState<(CharacterItem | null)[]>([null, null, null, null, null]);

    const [isUserTurn, setIsUserTurn] = useState(true);
    const [currentDraw, setCurrentDraw] = useState<CharacterItem | null>(null);
    const [skipsRemaining, setSkipsRemaining] = useState(MAX_SKIPS);


    const [gameStatus, setGameStatus] = useState<'LOADING' | 'FILTERING' | 'READY' | 'DRAFTING' | 'GRADING' | 'FINISHED' | 'ERROR'>('LOADING');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result, setResult] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');

    // Initialize Pool
    useEffect(() => {
        let mounted = true;
        async function init() {
            try {
                console.log("Fetching characters...");

                // create a timeout promise
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Connection timed out")), 8000)
                );

                // race against fetch
                const chars = await Promise.race([
                    getCharacters(500), // Fetch a large pool
                    timeoutPromise
                ]) as CharacterItem[];

                if (mounted) {
                    if (chars && chars.length > 0) {
                        setAllCharacters(chars);

                        // Extract Universes
                        const universes = Array.from(new Set(chars.map(c => c.animeUniverse))).sort();
                        setAvailableUniverses(universes);
                        setSelectedUniverses(universes); // Default select all

                        setGameStatus('FILTERING');
                    } else {
                        throw new Error("No characters found in database.");
                    }
                }
            } catch (error) {
                console.error("Error initializing draft:", error);
                if (mounted) {
                    setErrorMsg(error instanceof Error ? error.message : "Failed to load");
                    setGameStatus('ERROR');
                }
            }
        }
        init();
        return () => { mounted = false; };
    }, []);

    const drawCardFromPool = () => {
        const pool = [...characterPool];
        if (pool.length === 0) return null;
        const pick = pool.shift();
        setCharacterPool(pool);
        return pick;
    };

    // CPU Turn Logic
    useEffect(() => {
        if (!isUserTurn && gameStatus === 'DRAFTING') {
            const emptyCpuSlots = cpuTeam.map((c, i) => c === null ? i : -1).filter(i => i !== -1);

            if (emptyCpuSlots.length > 0) {
                const timer = setTimeout(() => {
                    const pick = drawCardFromPool();
                    if (pick) {
                        // CPU Simple Logic: Pick random empty slot
                        const randomSlotIndex = emptyCpuSlots[Math.floor(Math.random() * emptyCpuSlots.length)];

                        setCpuTeam(prev => {
                            const newTeam = [...prev];
                            newTeam[randomSlotIndex] = pick;
                            return newTeam;
                        });
                        setIsUserTurn(true);
                        setCurrentDraw(null);
                    }
                }, 1500);
                return () => clearTimeout(timer);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isUserTurn, gameStatus, cpuTeam, characterPool]);

    // Check for Game End
    const isGameFull = userTeam.every(Boolean) && cpuTeam.every(Boolean);


    const handleUserSummon = () => {
        if (!isUserTurn || gameStatus !== 'DRAFTING' || currentDraw) return;
        const char = drawCardFromPool();
        if (char) setCurrentDraw(char);
    };

    const handleSkip = () => {
        if (!currentDraw || skipsRemaining <= 0) return;
        setSkipsRemaining(prev => prev - 1);
        setCurrentDraw(null);
        // Auto re-summon
        const newChar = drawCardFromPool();
        if (newChar) setCurrentDraw(newChar);
    };

    const handleSlotClick = (index: number) => {
        if (!isUserTurn || !currentDraw || userTeam[index] !== null) return;

        setUserTeam(prev => {
            const newTeam = [...prev];
            newTeam[index] = currentDraw;
            return newTeam;
        });

        setCurrentDraw(null); // Clear active card
        setIsUserTurn(false); // Pass turn
    };

    const toggleUniverse = (universe: string) => {
        setSelectedUniverses(prev =>
            prev.includes(universe)
                ? prev.filter(u => u !== universe)
                : [...prev, universe]
        );
    };

    const selectAllUniverses = () => setSelectedUniverses(availableUniverses);
    const deselectAllUniverses = () => setSelectedUniverses([]);

    const confirmDeck = () => {
        if (selectedUniverses.length === 0) {
            alert("Please select at least one universe!");
            return;
        }

        // Filter and Shuffle Logic
        const filtered = allCharacters.filter(c => selectedUniverses.includes(c.animeUniverse));
        const shuffled = filtered.sort(() => 0.5 - Math.random()).slice(0, 50); // Take top 50 shuffled

        if (shuffled.length < 10) {
            alert(`Pool too small! Only ${shuffled.length} characters found. Select more universes.`);
            return;
        }

        setCharacterPool(shuffled);
        setGameStatus('DRAFTING');
    };


    const handleGameEnd = async () => {
        setGameStatus('GRADING');
        try {
            const res = await submitMatch('user-123', userTeam, cpuTeam);
            setResult(res);
            setGameStatus('FINISHED');
        } catch (e) {
            console.error(e);
            setGameStatus('FINISHED');
            setResult({ isWin: false, logs: ["Error calculating results. Please try again."] });
        }
    };

    if (gameStatus === 'ERROR') return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <div className="text-red-500 font-bold text-xl">⚠️ ERROR: {errorMsg}</div>
            <button onClick={() => window.location.reload()} className="bg-white text-black px-6 py-2 rounded-full font-bold">RETRY</button>
        </div>
    );

    if (gameStatus === 'LOADING') return <div className="text-white text-center py-20 animate-pulse font-mono">LOADING DATA (Please Wait)...</div>;

    // ----- UI RENDER -----

    if (gameStatus === 'FILTERING') {
        return (
            <div className="w-full max-w-4xl mx-auto p-8 bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl mt-10">
                <h1 className="text-4xl font-black text-white text-center mb-2">SETUP YOUR DECK</h1>
                <p className="text-slate-400 text-center mb-8">Select which Anime Universes will appear in the draft pool.</p>

                <div className="flex justify-center gap-4 mb-6">
                    <button onClick={selectAllUniverses} className="text-sm bg-slate-800 hover:bg-slate-700 text-blue-300 px-4 py-2 rounded">Select All</button>
                    <button onClick={deselectAllUniverses} className="text-sm bg-slate-800 hover:bg-slate-700 text-red-300 px-4 py-2 rounded">Deselect All</button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {availableUniverses.map(universe => (
                        <div
                            key={universe}
                            onClick={() => toggleUniverse(universe)}
                            className={`
                                cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center justify-between
                                ${selectedUniverses.includes(universe)
                                    ? 'bg-blue-900/30 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                                    : 'bg-slate-950 border-slate-800 opacity-60 hover:opacity-100'}
                            `}
                        >
                            <span className="font-bold text-white truncate">{universe}</span>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedUniverses.includes(universe) ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`}>
                                {selectedUniverses.includes(universe) && <span className="text-white text-xs">✓</span>}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-center flex-col items-center gap-2">
                    <button
                        onClick={confirmDeck}
                        className="bg-yellow-400 hover:bg-yellow-300 text-black font-black text-2xl py-4 px-12 rounded-full shadow-[0_0_30px_rgba(250,204,21,0.5)] transition-transform hover:scale-105 active:scale-95"
                    >
                        ENTER THE DRAFT
                    </button>
                    <span className="text-slate-500 text-sm">{selectedUniverses.length} Universes Selected</span>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-7xl mx-auto p-4 flex flex-col gap-8">
            {/* HEADER */}
            <div className="flex justify-between items-center bg-slate-900/80 p-4 rounded-xl border border-slate-700">
                <div className="text-white font-bold">
                    TURN: <span className={isUserTurn ? "text-yellow-400" : "text-red-500"}>{isUserTurn ? 'YOUR TURN' : 'CPU TURN'}</span>
                </div>
                <div className="text-blue-400 font-mono">
                    SKIPS: {skipsRemaining}/{MAX_SKIPS}
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-8 min-h-[600px]">
                {/* USER TEAM (The Clickable Slots) */}
                <div className="xl:w-1/4 flex flex-col gap-4">
                    <h2 className="text-xl font-black text-blue-400 text-center mb-2">YOUR SQUAD</h2>
                    {userTeam.map((char, i) => (
                        <div
                            key={`user-slot-${i}`}
                            onClick={() => handleSlotClick(i)}
                            className={`
                                h-28 w-full rounded-xl border-2 flex items-center justify-center relative overflow-hidden transition-all duration-300
                                ${char ? 'border-blue-500 bg-slate-900' : 'bg-slate-900/50 border-dashed border-slate-700'}
                                ${!char && currentDraw && isUserTurn ? 'cursor-pointer hover:border-yellow-400 hover:bg-yellow-400/10 shadow-[0_0_15px_rgba(250,204,21,0.3)] animate-pulse' : ''}
                            `}
                        >
                            <div className="absolute top-1 right-2 flex flex-col items-end z-10">
                                <span className="text-[10px] font-bold text-blue-500 tracking-widest">{ROLES[i]}</span>
                                {/* SHOW STARS only AFTER placement */}
                                {char && (
                                    <div className="text-yellow-400 text-xs font-mono">
                                        {'⭐'.repeat((char.stats.roleStats[ROLES_KEY[i]] as number) || 1)}
                                    </div>
                                )}
                            </div>

                            {char ? (
                                <div className="w-full h-full relative group">
                                    <Image src={char.imageUrl} alt={char.name} fill className="object-cover" />
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center pointer-events-none p-1">
                                        <span className="text-white font-bold text-lg text-center drop-shadow-md leading-tight">{char.name}</span>
                                        {/* Show AI Reason if available */}
                                        {char.stats.roleStats.reason && (
                                            <span className="text-[8px] text-yellow-200/80 text-center leading-none mt-1 max-w-full px-1">
                                                &quot;{char.stats.roleStats.reason}&quot;
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <span className="text-slate-600 text-sm font-mono">
                                    {currentDraw && isUserTurn ? "PLACE HERE" : "EMPTY"}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* CENTER (Summon & Action Area) */}
                <div className="xl:w-1/2 flex items-center justify-center bg-slate-950 rounded-2xl border-2 border-slate-800 relative overflow-hidden p-8 min-h-[500px]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 pointer-events-none" />

                    {/* Summon Button */}
                    {gameStatus === 'DRAFTING' && isUserTurn && !currentDraw && (
                        <button onClick={handleUserSummon} className="relative z-10 group">
                            <div className="w-64 h-80 bg-slate-800 rounded-xl border-4 border-slate-600 flex items-center justify-center group-hover:border-yellow-400 group-hover:shadow-[0_0_30px_rgba(250,204,21,0.3)] transition-all">
                                <div className="text-center">
                                    <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🔮</div>
                                    <div className="font-bold text-white text-xl">SUMMON</div>
                                </div>
                            </div>
                        </button>
                    )}

                    {/* Drawn Character View (STATS HIDDEN) */}
                    {gameStatus === 'DRAFTING' && currentDraw && (
                        <div className="flex flex-col items-center gap-6 animate-zoom-in relative z-10 w-full">
                            <div className="flex flex-col items-center">
                                <div className="scale-110 mb-4 w-64">
                                    <CharacterCard character={currentDraw} hideStats={true} />
                                </div>
                                <div className="bg-blue-900/30 border border-blue-500/30 px-4 py-2 rounded text-blue-300 text-sm font-mono">
                                    Use your Anime Knowledge!
                                </div>
                            </div>

                            <button
                                onClick={handleSkip}
                                disabled={skipsRemaining === 0}
                                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-8 rounded-full shadow-lg mt-4"
                            >
                                SKIP ({skipsRemaining})
                            </button>
                            <div className="text-center text-[10px] text-slate-500 mt-2">
                                Click a slot on the left to assign this character based on their LORE aptitude.
                            </div>
                        </div>
                    )}

                    {gameStatus === 'DRAFTING' && !isUserTurn && (
                        <div className="text-center animate-pulse">
                            <div className="text-6xl mb-4">🤖</div>
                            <div className="text-red-400 font-mono text-xl">OPPONENT TURN...</div>
                        </div>
                    )}

                    {/* Reveal Button */}
                    {gameStatus === 'DRAFTING' && isGameFull && (
                        <button onClick={handleGameEnd} className="relative z-10 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-10 rounded-full animate-bounce shadow-2xl border-4 border-blue-400">
                            REVEAL WINNER
                        </button>
                    )}

                    {/* Results */}
                    {(gameStatus === 'FINISHED' || gameStatus === 'GRADING') && (
                        <div className="text-center w-full z-20">
                            <h1 className={`text-6xl font-black mb-4 ${result?.isWin ? 'text-green-500' : 'text-red-500'}`}>
                                {result?.isWin ? 'VICTORY' : 'DEFEAT'}
                            </h1>
                            <div className="bg-black/50 p-4 rounded-lg h-64 overflow-y-auto mb-6 text-left font-mono">
                                {result?.logs.map((log: string, i: number) => (
                                    <div key={i} className={`py-1 border-b border-white/10 ${log.includes("WINS") ? "text-green-300" : log.includes("LOSES") ? "text-red-300" : "text-white"}`}>{log}</div>
                                ))}
                            </div>
                            <button onClick={() => window.location.reload()} className="bg-white text-black font-bold py-3 px-8 rounded-full">AGAIN</button>
                        </div>
                    )}
                </div>

                {/* CPU TEAM */}
                <div className="xl:w-1/4 flex flex-col gap-4">
                    <h2 className="text-xl font-black text-red-500 text-center mb-2">ENEMY SQUAD</h2>
                    {cpuTeam.map((char, i) => (
                        <div key={`cpu-slot-${i}`} className="h-28 w-full rounded-xl border border-red-500/30 bg-slate-900/50 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute top-1 left-2 flex flex-col z-10">
                                <span className="text-[10px] font-bold text-red-500 tracking-widest">{ROLES[i]}</span>
                                {char && (
                                    <div className="text-red-400 text-xs font-mono">
                                        {'⭐'.repeat((char.stats?.roleStats?.[ROLES_KEY[i]] as number) || 1)}
                                    </div>
                                )}
                            </div>
                            {char ? (
                                <div className="w-full h-full relative">
                                    <Image src={char.imageUrl} alt="Enemy" fill className="object-cover grayscale opacity-50" />
                                    <div className="absolute inset-0 bg-red-900/30" />
                                </div>
                            ) : (
                                <span className="text-slate-700 text-xs">Waiting...</span>
                            )}
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
