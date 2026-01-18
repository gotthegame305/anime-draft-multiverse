'use client'

import { useState, useEffect } from 'react'
import { updateUserStats } from '@/app/actions'
import Image from 'next/image'

interface Character {
    id: number
    name: string
    imageUrl: string
    animeUniverse: string
    stats: any // using any for Json type, or could be more specific if known
}

interface DraftGameProps {
    initialCharacters: Character[]
    userId?: string // Optional for now
}

const ROLES = ['Captain', 'Vice Captain', 'Tank', 'Duelist', 'Support']
const INITIAL_SKIPS = 2

export default function DraftGame({ initialCharacters, userId }: DraftGameProps) {
    const [universes, setUniverses] = useState<string[]>([])
    const [selectedUniverses, setSelectedUniverses] = useState<string[]>([])

    // Game State
    const [gameState, setGameState] = useState<'FILTER' | 'PLAYING' | 'RESULT'>('FILTER')

    const [deck, setDeck] = useState<Character[]>([])
    const [hand, setHand] = useState<Character | null>(null)
    const [board, setBoard] = useState<(Character | null)[]>([null, null, null, null, null])
    const [opponentTeam, setOpponentTeam] = useState<Character[]>([])
    const [skips, setSkips] = useState(INITIAL_SKIPS)
    const [result, setResult] = useState<'win' | 'loss' | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isMuted, setIsMuted] = useState(false) // Audio state

    // Audio Constants
    const IMPACT_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3' // Gacha/Whoosh Sound

    // Initialize universes on load
    useEffect(() => {
        const uniqueUniverses = Array.from(new Set(initialCharacters.map(c => c.animeUniverse))).sort()
        setUniverses(uniqueUniverses)
        setSelectedUniverses(uniqueUniverses) // Select all by default
    }, [initialCharacters])

    // Start Game: Filter and Shuffle
    const startGame = () => {
        const filtered = initialCharacters.filter(c => selectedUniverses.includes(c.animeUniverse))
        const shuffled = [...filtered].sort(() => 0.5 - Math.random())
        setDeck(shuffled)
        setGameState('PLAYING')
    }

    // Audio Helpers
    const playImpactSound = () => {
        if (isMuted) return
        try {
            const audio = new Audio(IMPACT_SOUND_URL)
            audio.volume = 0.5
            audio.play().catch(e => console.error("Audio play failed:", e))
        } catch (error) {
            console.error("Audio error:", error)
        }
    }

    const announceCharacter = (text: string) => {
        if (isMuted || !window.speechSynthesis) return

        // Cancel previous speech to avoid queueing
        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.volume = 1.0
        utterance.rate = 1.1 // Slightly faster/excited

        // Try to get Japanese voice, fallback to default
        const voices = window.speechSynthesis.getVoices()
        const jaVoice = voices.find(v => v.lang.includes('ja') || v.lang === 'ja-JP')

        if (jaVoice) {
            utterance.voice = jaVoice
        }

        window.speechSynthesis.speak(utterance)
    }

    // Draw Card
    const drawCard = () => {
        if (deck.length === 0) return
        const newDeck = [...deck]
        const drawn = newDeck.pop() || null
        setDeck(newDeck)
        setHand(drawn)

        if (drawn) {
            playImpactSound()
            // Small delay for name announcement to let impact sound hit first
            setTimeout(() => announceCharacter(drawn.name), 300)
        }
    }

    // Place Card
    const placeCharacter = (index: number) => {
        if (!hand || board[index]) return

        const newBoard = [...board]
        newBoard[index] = hand
        setBoard(newBoard)
        setHand(null)

        // Check if board is full
        if (newBoard.every(slot => slot !== null)) {
            generateOpponent(newBoard as Character[], deck) // Pass remaining deck for opponent generation
        }
    }

    // Skip Card
    const skipCard = () => {
        if (skips > 0 && hand) {
            setSkips(prev => prev - 1)
            setHand(null)
        }
    }

    // Generate Opponent & Show Result
    const generateOpponent = (playerBoard: Character[], remainingDeck: Character[]) => {
        // Ideally we want a distinct set of characters, so we continue from the remaining deck
        // If we run out, we might need to reuse 'initialCharacters' excluding player board.

        let opponentDeck = [...remainingDeck]
        if (opponentDeck.length < 5) {
            // Fallback if deck is too small: reshuffle everything excluding player board
            const usedIds = new Set(playerBoard.map(c => c.id))
            opponentDeck = initialCharacters.filter(c => !usedIds.has(c.id)).sort(() => 0.5 - Math.random())
        }

        const opponent = opponentDeck.slice(0, 5)
        setOpponentTeam(opponent)
        setGameState('RESULT')
    }

    // Submit Result
    const handleGameEnd = async (outcome: 'win' | 'loss') => {
        setResult(outcome)
        if (userId) {
            setIsSubmitting(true)
            await updateUserStats(userId, outcome)
            setIsSubmitting(false)
        }
    }

    const resetGame = () => {
        setGameState('FILTER')
        setBoard([null, null, null, null, null])
        setHand(null)
        setSkips(INITIAL_SKIPS)
        setResult(null)
        setOpponentTeam([])
    }

    // --- RENDER ---

    if (gameState === 'FILTER') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-950 text-white">
                <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-800">
                    <h1 className="text-3xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        Multiverse Draft
                    </h1>
                    <p className="mb-4 text-gray-400 text-center">Select active universes:</p>
                    <div className="space-y-3 max-h-60 overflow-y-auto mb-6 pr-2 scrollbar-thin scrollbar-thumb-gray-700">
                        {universes.map(u => (
                            <label key={u} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-800 transition cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedUniverses.includes(u)}
                                    onChange={(e) => {
                                        if (e.target.checked) setSelectedUniverses(prev => [...prev, u])
                                        else setSelectedUniverses(prev => prev.filter(x => x !== u))
                                    }}
                                    className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500 bg-gray-700 border-gray-600"
                                />
                                <span className="text-lg">{u}</span>
                            </label>
                        ))}
                    </div>
                    <button
                        onClick={startGame}
                        disabled={selectedUniverses.length === 0}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-blue-500/25"
                    >
                        Start Draft
                    </button>
                </div>
            </div>
        )
    }

    if (gameState === 'RESULT') {
        return (
            <div className="flex flex-col items-center justify-start min-h-screen p-4 bg-gray-950 text-white overflow-y-auto">
                <h1 className="text-4xl font-extrabold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500">
                    Community Vote
                </h1>

                <div className="grid grid-cols-2 gap-4 w-full max-w-4xl mb-8">
                    {/* Player Team */}
                    <div className="bg-gray-900/50 p-4 rounded-xl border border-blue-500/30">
                        <h2 className="text-xl font-bold mb-4 text-blue-400 text-center">Your Team</h2>
                        <div className="space-y-4">
                            {board.map((char, i) => (
                                <div key={i} className="flex items-center space-x-3 p-2 bg-gray-800 rounded-lg border border-gray-700">
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-blue-500 flex-shrink-0">
                                        {char?.imageUrl && <Image src={char.imageUrl} alt={char.name} fill className="object-cover" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{char?.name}</p>
                                        <p className="text-xs text-gray-400">{ROLES[i]}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Opponent Team */}
                    <div className="bg-gray-900/50 p-4 rounded-xl border border-red-500/30">
                        <h2 className="text-xl font-bold mb-4 text-red-400 text-center">Opponent Team</h2>
                        <div className="space-y-4">
                            {opponentTeam.map((char, i) => (
                                <div key={i} className="flex items-center space-x-3 p-2 bg-gray-800 rounded-lg border border-gray-700">
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-red-500 flex-shrink-0">
                                        {char?.imageUrl ? (
                                            <Image src={char.imageUrl} alt={char.name} fill className="object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gray-700" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{char?.name || 'Unknown'}</p>
                                        <p className="text-xs text-gray-400">{ROLES[i]}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {!result ? (
                    <div className="flex space-x-6">
                        <button
                            onClick={() => handleGameEnd('win')}
                            disabled={isSubmitting}
                            className="px-8 py-4 rounded-full bg-green-600 hover:bg-green-500 text-white font-bold text-xl shadow-lg shadow-green-500/30 transition-all transform hover:scale-105"
                        >
                            I Won 🏆
                        </button>
                        <button
                            onClick={() => handleGameEnd('loss')}
                            disabled={isSubmitting}
                            className="px-8 py-4 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xl shadow-lg shadow-red-500/30 transition-all transform hover:scale-105"
                        >
                            I Lost 💀
                        </button>
                    </div>
                ) : (
                    <div className="text-center animate-bounce">
                        <h2 className="text-3xl font-bold mb-4">
                            {result === 'win' ? 'Victory Recorded!' : 'Defeat Recorded...'}
                        </h2>
                        <button
                            onClick={resetGame}
                            className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition"
                        >
                            Play Again
                        </button>
                    </div>
                )}
            </div>
        )
    }

    // PLAYING STATE
    return (
        <div className="flex flex-col h-[100dvh] bg-gray-950 text-white overflow-hidden relative">
            {/* Background/Decoration */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-gray-950 pointer-events-none" />

            {/* Header */}
            <header className="py-4 px-4 flex justify-between items-center z-10 bg-gray-900/80 backdrop-blur-sm sticky top-0 border-b border-gray-800">
                <span className="font-bold text-lg text-gray-300">Anime Draft</span>

                <div className="flex items-center space-x-4">
                    {/* Mute Toggle */}
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-2 rounded-full transition-colors ${isMuted ? 'bg-red-900/50 text-red-400' : 'bg-gray-800 text-green-400 hover:bg-gray-700'}`}
                        title={isMuted ? "Unmute Audio" : "Mute Audio"}
                    >
                        {isMuted ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>

                    <div className="flex items-center space-x-2 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                        <span className="text-xs uppercase tracking-wider text-gray-400">Skips</span>
                        <span className={`font-mono font-bold ${skips > 0 ? 'text-green-400' : 'text-red-500'}`}>{skips}</span>
                    </div>
                </div>
            </header>

            {/* Main Content Area: Board + Controls */}
            <main className="flex-1 flex flex-col items-center justify-between p-4 z-10 w-full max-w-lg mx-auto">

                {/* The Board */}
                <div className="w-full space-y-3 flex-1 overflow-y-auto my-4 no-scrollbar">
                    {board.map((char, index) => (
                        <button
                            key={index}
                            onClick={() => placeCharacter(index)}
                            disabled={!hand || char !== null}
                            className={`w-full relative h-20 sm:h-24 rounded-xl border transition-all duration-300 flex items-center px-4 space-x-4
                 ${char
                                    ? 'bg-gray-800 border-gray-700 opacity-100'
                                    : hand
                                        ? 'bg-gray-900/50 border-blue-500/50 hover:bg-blue-900/20 hover:border-blue-400 cursor-pointer animate-pulse'
                                        : 'bg-gray-900/30 border-gray-800 cursor-default'}
               `}
                        >
                            {/* Role Label */}
                            <span className="absolute top-1 right-2 text-[10px] uppercase font-bold tracking-widest text-gray-500">
                                {ROLES[index]}
                            </span>

                            {char ? (
                                <>
                                    <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-purple-500 flex-shrink-0 shadow-lg shadow-purple-500/20">
                                        <Image src={char.imageUrl} alt={char.name} fill className="object-cover object-top" />
                                    </div>
                                    <div className="flex-col items-start text-left">
                                        <p className="font-bold text-lg leading-tight">{char.name}</p>
                                        <p className="text-xs text-blue-400">{char.animeUniverse}</p>
                                    </div>
                                </>
                            ) : (
                                <span className="text-gray-600 font-medium text-sm">Empty Slot</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Hand / Draw Section */}
                <div className="w-full h-64 flex items-center justify-center relative mb-4">
                    {hand ? (
                        <div className="relative w-48 h-full bg-gray-800 rounded-2xl border-2 border-blue-500 shadow-2xl shadow-blue-500/20 flex flex-col items-center overflow-hidden animate-in fade-in zoom-in duration-300 group">
                            <div className="relative w-full h-full">
                                <Image src={hand.imageUrl} alt={hand.name} fill className="object-cover object-top" />
                                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-900/40 to-transparent" />
                            </div>
                            <div className="absolute bottom-0 w-full p-4 text-center z-10">
                                <h3 className="font-bold text-2xl leading-none mb-1 text-white text-shadow-sm">{hand.name}</h3>
                                <p className="text-sm text-blue-300 font-medium">{hand.animeUniverse}</p>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={drawCard}
                            className="group relative w-32 h-44 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl shadow-xl shadow-indigo-500/20 border-2 border-indigo-400/30 transform hover:-translate-y-2 transition-all duration-300 flex items-center justify-center"
                        >
                            <span className="font-bold text-white text-lg group-hover:scale-110 transition-transform">DRAW</span>
                            <div className="absolute inset-0 border-2 border-white/10 rounded-xl m-1" />
                        </button>
                    )}
                </div>

                {/* Action Buttons (Skip) */}
                <div className="w-full h-12 flex justify-center">
                    {hand && skips > 0 && (
                        <button
                            onClick={skipCard}
                            className="px-6 py-2 rounded-full bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-700 transition flex items-center space-x-2"
                        >
                            <span>SKIP</span>
                            <span className="text-xs bg-red-950 px-2 py-0.5 rounded-full">{skips}</span>
                        </button>
                    )}
                </div>

            </main>
        </div>
    )
}
