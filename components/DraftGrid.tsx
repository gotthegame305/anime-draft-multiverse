'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import BattleReplay from '@/components/BattleReplay';
import StarPips from '@/components/StarPips';
import { getCharacters, submitMatch, type CharacterItem } from '@/app/actions';
import type { ScoreBreakdown } from '@/lib/battleEngine';
import type { CharacterItem as ReplayCardItem, ReplayEvent, ReplayScenario, SynergyRow } from '@/lib/replayTypes';
import { BASE_ROLES, ROLE_DISPLAY_NAMES, type RoleKey } from '@/lib/gameConfig';
import { evaluateSynergyBoard, type SynergyProgress } from '@/lib/synergyBoard';

const MAX_SKIPS = 1;
const DRAFT_METRICS = {
    cardWidth: 144,
    cardHeight: 194,
    rowGap: 18,
    squadColumnWidth: 430,
    squadPaddingX: 48,
    stageGap: 26,
    laneWidth: 240,
    headerHeight: 42,
} as const;

interface MatchResult {
    isWin: boolean;
    userScore: number;
    cpuScore: number;
    logs: string[];
    userBreakdown: ScoreBreakdown;
    cpuBreakdown: ScoreBreakdown;
    replayEvents: ReplayEvent[];
}

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ');
}

function formatBreakdownSummary(breakdown: ScoreBreakdown) {
    return `combat ${breakdown.combatPoints} | stars ${breakdown.rawStarPoints} | universe ${breakdown.universeBonusPoints} | fit ${breakdown.bestRolePoints} | sweep ${breakdown.starSweepPoints}`;
}

function roleLabel(role: RoleKey) {
    return ROLE_DISPLAY_NAMES[role];
}

function getStageHeight(roleCount: number) {
    return DRAFT_METRICS.headerHeight + (roleCount * DRAFT_METRICS.cardHeight) + ((roleCount - 1) * DRAFT_METRICS.rowGap) + 38;
}

function getLaneExtents() {
    const cardInset = DRAFT_METRICS.squadPaddingX + ((DRAFT_METRICS.squadColumnWidth - (DRAFT_METRICS.squadPaddingX * 2) - DRAFT_METRICS.cardWidth) / 2);
    return {
        leftReach: DRAFT_METRICS.squadColumnWidth + DRAFT_METRICS.stageGap - cardInset,
        rightReach: DRAFT_METRICS.stageGap + cardInset + DRAFT_METRICS.cardWidth,
    };
}

function toReplayTone(synergy: SynergyProgress): SynergyRow['tone'] {
    if (synergy.statusTone === 'completed') {
        return synergy.id === 'star-sweep' ? 'amber' : 'emerald';
    }

    switch (synergy.id) {
        case 'twin-realms':
            return 'sky';
        case 'multiverse-tour':
            return 'emerald';
        case 'perfect-casting':
            return 'teal';
        case 'star-sweep':
            return 'amber';
        case 'power-curve':
            return 'yellow';
        default:
            return 'cyan';
    }
}

function toReplayRows(team: (CharacterItem | null)[], roles: RoleKey[]): SynergyRow[] {
    return evaluateSynergyBoard(team, roles)
        .filter((synergy) => synergy.visible)
        .map((synergy) => ({
            symbol: synergy.symbol,
            label: synergy.label,
            progress: synergy.progressText,
            tone: toReplayTone(synergy),
            hint: synergy.tooltipText,
        }));
}

function toReplayCards(team: (CharacterItem | null)[], roles: RoleKey[]): ReplayCardItem[] {
    return team.flatMap((char, index) => {
        if (!char) return [];
        const role = roles[index];

        return [{
            id: char.id,
            name: char.name,
            imageUrl: char.imageUrl,
            animeUniverse: char.animeUniverse,
            stars: Number(char.stats.roleStats[role] || 1),
            favorites: char.stats.favorites,
            verificationReason: char.stats.roleStats.reason,
        }];
    });
}

function buildReplayScenario(userTeam: (CharacterItem | null)[], cpuTeam: (CharacterItem | null)[], roles: RoleKey[], events: ReplayEvent[]): ReplayScenario {
    return {
        player: {
            id: 'player',
            title: 'Your Squad',
            displayName: 'You',
            accent: 'cyan',
            cards: toReplayCards(userTeam, roles),
            synergies: toReplayRows(userTeam, roles),
        },
        opponents: [
            {
                id: 'enemy',
                title: 'Enemy Squad',
                displayName: 'CPU',
                accent: 'fuchsia',
                cards: toReplayCards(cpuTeam, roles),
                synergies: toReplayRows(cpuTeam, roles),
            },
        ],
        events,
    };
}

function ScoreSummaryPanel({ label, value, tone }: { label: string; value: string; tone: 'cyan' | 'fuchsia' | 'amber' }) {
    const toneClass = tone === 'cyan'
        ? 'border-cyan-300/28 bg-[linear-gradient(160deg,rgba(4,17,31,0.98),rgba(3,9,18,0.96))] text-cyan-100'
        : tone === 'fuchsia'
            ? 'border-fuchsia-300/28 bg-[linear-gradient(160deg,rgba(17,6,22,0.98),rgba(7,8,17,0.96))] text-fuchsia-100'
            : 'border-yellow-300/38 bg-[linear-gradient(160deg,rgba(25,17,4,0.98),rgba(8,10,18,0.96))] text-yellow-100';

    return (
        <div className={cx('hud-panel border px-4 py-3', toneClass)}>
            <div className="text-[9px] font-black uppercase tracking-[0.34em] text-white/55">{label}</div>
            <div className="mt-1 text-[18px] font-black uppercase tracking-[0.08em]">{value}</div>
        </div>
    );
}

function DraftSynergyRail({ synergies }: { synergies: SynergyProgress[] }) {
    const visibleSynergies = synergies.filter((synergy) => synergy.visible);

    if (visibleSynergies.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            {visibleSynergies.map((synergy) => {
                const toneClass = synergy.statusTone === 'completed'
                    ? 'border-emerald-300/45 bg-emerald-400/10 text-emerald-100'
                    : toReplayTone(synergy) === 'yellow'
                        ? 'border-yellow-300/45 bg-yellow-400/10 text-yellow-100'
                        : toReplayTone(synergy) === 'amber'
                            ? 'border-amber-300/45 bg-amber-400/10 text-amber-100'
                            : toReplayTone(synergy) === 'teal'
                                ? 'border-teal-300/45 bg-teal-400/10 text-teal-100'
                                : toReplayTone(synergy) === 'sky'
                                    ? 'border-sky-300/45 bg-sky-400/10 text-sky-100'
                                    : 'border-cyan-300/45 bg-cyan-400/10 text-cyan-100';

                return (
                    <div key={synergy.id} className="hud-chip flex items-center gap-1.5 border border-white/8 bg-[#09111d]/95 px-1.5 py-1 shadow-[0_8px_18px_rgba(0,0,0,0.36)]" title={synergy.tooltipText}>
                        <div className={cx('hud-chip min-w-[30px] border px-1.5 py-1 text-center text-[8px] font-black uppercase tracking-[0.1em]', toneClass)}>
                            {synergy.symbol}
                        </div>
                        <div className="w-[72px] leading-tight text-left">
                            <div className="truncate text-[8px] font-black uppercase tracking-[0.08em] text-white/90">{synergy.label}</div>
                            <div className="truncate text-[8px] text-white/45">{synergy.progressText}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function SquadSlot({
    char,
    role,
    accent,
    emptyLabel,
    clickable,
    onClick,
    showRoleStars = true,
    showReason = true,
}: {
    char: CharacterItem | null;
    role: RoleKey;
    accent: 'cyan' | 'fuchsia';
    emptyLabel: string;
    clickable?: boolean;
    onClick?: () => void;
    showRoleStars?: boolean;
    showReason?: boolean;
}) {
    const roleStars = char ? Number(char.stats.roleStats[role] || 1) : 0;
    const accentClasses = accent === 'cyan'
        ? 'border-cyan-300/24 bg-[linear-gradient(180deg,rgba(8,20,34,0.96),rgba(5,12,20,0.94))]'
        : 'border-fuchsia-300/24 bg-[linear-gradient(180deg,rgba(23,10,27,0.96),rgba(7,10,18,0.94))]';
    const emptyBorder = accent === 'cyan' ? 'border-cyan-300/22 text-cyan-100/40' : 'border-fuchsia-300/22 text-fuchsia-100/40';

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!clickable}
            className={cx('relative flex items-center justify-center transition duration-200', clickable ? 'cursor-pointer hover:scale-[1.015]' : 'cursor-default')}
            style={{ height: DRAFT_METRICS.cardHeight }}
        >
            <div
                className={cx(
                    'anime-card relative overflow-hidden border shadow-[0_14px_28px_rgba(0,0,0,0.34)] transition duration-200',
                    char ? accentClasses : `border-dashed bg-black/28 ${emptyBorder}`,
                    clickable && accent === 'cyan' && 'hover:border-cyan-300 hover:shadow-[0_0_26px_rgba(34,211,238,0.22)]',
                    clickable && accent === 'fuchsia' && 'hover:border-fuchsia-300 hover:shadow-[0_0_26px_rgba(217,70,239,0.22)]'
                )}
                style={{ width: DRAFT_METRICS.cardWidth, height: DRAFT_METRICS.cardHeight }}
            >
                {char ? (
                    <>
                        <Image src={char.imageUrl} alt={char.name} fill className={cx('object-cover', accent === 'fuchsia' && 'grayscale-[0.18]')} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/18 to-transparent" />
                        <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(34,211,238,0.16),transparent_34%,transparent_72%,rgba(217,70,239,0.18))]" />
                        <div className="absolute left-0 top-0 h-6 w-6 border-l-[3px] border-t-[3px] border-cyan-300/70" />
                        <div className="absolute bottom-0 right-0 h-6 w-6 border-b-[3px] border-r-[3px] border-fuchsia-300/60" />
                        <div className="absolute left-0 top-0 h-[2px] w-full bg-cyan-300/78" />
                        {showRoleStars && (
                            <div className="absolute right-2 top-2 border border-yellow-100/70 bg-yellow-300 px-2 py-1 shadow-lg">
                                <StarPips count={roleStars} tone="gold" />
                            </div>
                        )}
                        <div className="absolute inset-x-2 bottom-2 bg-black/50 px-2 py-1.5">
                            <div className="truncate text-[12px] font-black leading-none text-white">{char.name}</div>
                            <div className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-white/64">{char.animeUniverse}</div>
                            {showReason && char.stats.roleStats.reason && (
                                <div className="mt-1 truncate text-[8px] uppercase tracking-[0.12em] text-yellow-200/84">{char.stats.roleStats.reason}</div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(15,24,36,0.74),rgba(7,10,18,0.55))] px-4 text-center text-[11px] font-black uppercase tracking-[0.22em] text-white/40">
                        {emptyLabel}
                    </div>
                )}
            </div>
        </button>
    );
}

function RoleLane({ activeRoles }: { activeRoles: RoleKey[] }) {
    const { leftReach, rightReach } = getLaneExtents();
    const stageHeight = getStageHeight(activeRoles.length);

    return (
        <div className="relative z-0 flex flex-col px-3 py-3" style={{ minHeight: stageHeight, overflow: 'visible' }}>
            <div className="mb-3 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.42em] text-cyan-300/72" style={{ height: DRAFT_METRICS.headerHeight }}>
                Battle Lane
            </div>
            <div className="flex flex-col items-center" style={{ gap: DRAFT_METRICS.rowGap }}>
                {activeRoles.map((role) => {
                    const isTraitor = role === 'traitor';
                    return (
                        <div key={role} className="relative flex w-full items-center justify-center" style={{ height: DRAFT_METRICS.cardHeight, overflow: 'visible' }}>
                            <div
                                className={cx('pointer-events-none absolute top-1/2 -translate-y-1/2 border-y', isTraitor ? 'border-fuchsia-300/26 bg-[linear-gradient(90deg,rgba(244,114,182,0.10),rgba(6,12,20,0.03),rgba(244,114,182,0.10))]' : 'border-cyan-300/22 bg-[linear-gradient(90deg,rgba(34,211,238,0.10),rgba(6,12,20,0.03),rgba(34,211,238,0.10))]')}
                                style={{ left: -leftReach, right: -rightReach, height: DRAFT_METRICS.cardHeight + 12 }}
                            />
                            <div
                                className={cx('pointer-events-none absolute top-1/2 h-px -translate-y-1/2', isTraitor ? 'bg-fuchsia-300/75 shadow-[0_0_12px_rgba(244,114,182,0.26)]' : 'bg-cyan-300/78 shadow-[0_0_12px_rgba(34,211,238,0.24)]')}
                                style={{ left: -leftReach, right: -rightReach }}
                            />
                            <div className={cx('hud-chip relative z-20 border px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.12em]', isTraitor ? 'border-fuchsia-300/30 bg-[#150b1b] text-fuchsia-100' : 'border-cyan-300/28 bg-[#0b1322] text-cyan-100')}>
                                {roleLabel(role)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function DraftGrid() {
    const [allCharacters, setAllCharacters] = useState<CharacterItem[]>([]);
    const [characterPool, setCharacterPool] = useState<CharacterItem[]>([]);
    const [availableUniverses, setAvailableUniverses] = useState<string[]>([]);
    const [selectedUniverses, setSelectedUniverses] = useState<string[]>([]);
    const [playedModes, setPlayedModes] = useState<string[]>([]);
    const [activeRoles, setActiveRoles] = useState<RoleKey[]>([...BASE_ROLES]);
    const [userTeam, setUserTeam] = useState<(CharacterItem | null)[]>([null, null, null, null, null]);
    const [cpuTeam, setCpuTeam] = useState<(CharacterItem | null)[]>([null, null, null, null, null]);
    const [isUserTurn, setIsUserTurn] = useState(true);
    const [currentDraw, setCurrentDraw] = useState<CharacterItem | null>(null);
    const [skipsRemaining, setSkipsRemaining] = useState(MAX_SKIPS);
    const [gameStatus, setGameStatus] = useState<'LOADING' | 'FILTERING' | 'DRAFTING' | 'GRADING' | 'FINISHED' | 'ERROR'>('LOADING');
    const [result, setResult] = useState<MatchResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const isGameFull = userTeam.every(Boolean) && cpuTeam.every(Boolean);
    const liveSynergies = useMemo(() => evaluateSynergyBoard(userTeam, activeRoles), [activeRoles, userTeam]);
    const replayScenario = useMemo(() => {
        if (!result) return null;
        return buildReplayScenario(userTeam, cpuTeam, activeRoles, result.replayEvents);
    }, [activeRoles, cpuTeam, result, userTeam]);

    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 8000));
                const chars = await Promise.race([getCharacters(500), timeoutPromise]) as CharacterItem[];

                if (!mounted) return;
                if (!chars || chars.length === 0) throw new Error('No characters found in database.');

                setAllCharacters(chars);
                const universes = Array.from(new Set(chars.map((character) => character.animeUniverse))).sort();
                setAvailableUniverses(universes);
                setSelectedUniverses(universes);
                setGameStatus('FILTERING');
            } catch (error) {
                if (!mounted) return;
                setErrorMsg(error instanceof Error ? error.message : 'Failed to load');
                setGameStatus('ERROR');
            }
        }

        init();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!isUserTurn && gameStatus === 'DRAFTING') {
            const emptyCpuSlots = cpuTeam.map((char, index) => (char === null ? index : -1)).filter((index) => index !== -1);
            if (emptyCpuSlots.length === 0) return;

            const timer = setTimeout(() => {
                const pool = [...characterPool];
                const pick = pool.shift() || null;
                setCharacterPool(pool);
                if (!pick) return;

                const bestRoleValue = Math.max(...emptyCpuSlots.map((slotIndex) => Number(pick.stats.roleStats[activeRoles[slotIndex]] || 0)));
                const bestSlotIndexes = emptyCpuSlots.filter((slotIndex) => Number(pick.stats.roleStats[activeRoles[slotIndex]] || 0) === bestRoleValue);
                const useBestFit = Math.random() < 0.8;
                const slotPool = useBestFit && bestSlotIndexes.length > 0 ? bestSlotIndexes : emptyCpuSlots;
                const chosenSlotIndex = slotPool[Math.floor(Math.random() * slotPool.length)];

                setCpuTeam((prev) => {
                    const next = [...prev];
                    next[chosenSlotIndex] = pick;
                    return next;
                });
                setIsUserTurn(true);
                setCurrentDraw(null);
            }, 1400);

            return () => clearTimeout(timer);
        }

        return undefined;
    }, [activeRoles, characterPool, cpuTeam, gameStatus, isUserTurn]);

    function toggleUniverse(universe: string) {
        setSelectedUniverses((prev) => (prev.includes(universe) ? prev.filter((item) => item !== universe) : [...prev, universe]));
    }

    function confirmDeck() {
        if (selectedUniverses.length === 0) {
            window.alert('Please select at least one universe.');
            return;
        }

        const filtered = allCharacters.filter((character) => selectedUniverses.includes(character.animeUniverse) && character.stats.roleStats.reason === 'Verified Database Stats');
        const shuffled = [...filtered].sort(() => 0.5 - Math.random()).slice(0, 50);
        if (shuffled.length < 10) {
            window.alert(`Pool too small! Only ${shuffled.length} characters found. Select more universes.`);
            return;
        }

        let modeToPlay = 'standard';
        let modifier: 'aura' | 'traitor' | null = null;
        const isRematch = playedModes.length > 0;

        if (!isRematch) {
            const roll = Math.random();
            if (roll < 0.5) modeToPlay = 'standard';
            else if (roll < 0.75) modeToPlay = 'aura';
            else modeToPlay = 'traitor';
        } else if (!playedModes.includes('aura') && !playedModes.includes('traitor')) {
            modeToPlay = Math.random() < 0.5 ? 'aura' : 'traitor';
        } else if (playedModes.includes('aura') && !playedModes.includes('traitor')) {
            modeToPlay = 'traitor';
        } else if (playedModes.includes('traitor') && !playedModes.includes('aura')) {
            modeToPlay = 'aura';
        } else {
            modeToPlay = Math.random() < 0.5 ? 'aura' : 'traitor';
        }

        if (modeToPlay === 'aura') modifier = 'aura';
        if (modeToPlay === 'traitor') modifier = 'traitor';

        const roles = [...BASE_ROLES] as RoleKey[];
        if (modifier) roles.push(modifier);

        setPlayedModes((prev) => [...prev, modeToPlay]);
        setActiveRoles(roles);
        setUserTeam(new Array(roles.length).fill(null));
        setCpuTeam(new Array(roles.length).fill(null));
        setCharacterPool(shuffled);
        setCurrentDraw(null);
        setSkipsRemaining(MAX_SKIPS);
        setResult(null);
        setIsUserTurn(true);
        setGameStatus('DRAFTING');
    }

    function handleUserSummon() {
        if (!isUserTurn || gameStatus !== 'DRAFTING' || currentDraw) return;

        const pool = [...characterPool];
        const pick = pool.shift() || null;
        setCharacterPool(pool);
        if (pick) setCurrentDraw(pick);
    }

    function handleSkip() {
        if (!currentDraw || skipsRemaining <= 0) return;

        setSkipsRemaining((prev) => prev - 1);
        const pool = [...characterPool];
        const pick = pool.shift() || null;
        setCharacterPool(pool);
        setCurrentDraw(pick);
    }

    function handleSlotClick(index: number) {
        if (!isUserTurn || !currentDraw || userTeam[index] !== null) return;

        setUserTeam((prev) => {
            const next = [...prev];
            next[index] = currentDraw;
            return next;
        });
        setCurrentDraw(null);
        setIsUserTurn(false);
    }

    async function handleGameEnd() {
        setGameStatus('GRADING');

        try {
            const response = await submitMatch('user-123', userTeam, cpuTeam, activeRoles);
            setResult(response as MatchResult);
        } catch {
            setResult({
                isWin: false,
                userScore: 0,
                cpuScore: 0,
                logs: ['Error calculating results. Please try again.'],
                userBreakdown: { combatPoints: 0, rawStarPoints: 0, universeBonusPoints: 0, bestRolePoints: 0, starSweepPoints: 0, totalPoints: 0 },
                cpuBreakdown: { combatPoints: 0, rawStarPoints: 0, universeBonusPoints: 0, bestRolePoints: 0, starSweepPoints: 0, totalPoints: 0 },
                replayEvents: [],
            });
        }

        setGameStatus('FINISHED');
    }

    function resetToFilter() {
        setCurrentDraw(null);
        setSkipsRemaining(MAX_SKIPS);
        setResult(null);
        setGameStatus('FILTERING');
    }

    function handleRematch() {
        setCurrentDraw(null);
        setSkipsRemaining(MAX_SKIPS);
        setResult(null);
        confirmDeck();
    }

    if (gameStatus === 'ERROR') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#03050c] px-4 text-white">
                <div className="hud-panel w-full max-w-md border border-red-400/30 bg-[#08111c]/95 p-8 text-center">
                    <div className="text-[11px] font-black uppercase tracking-[0.36em] text-red-300/80">System Fault</div>
                    <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.08em] text-white">Draft Feed Offline</h1>
                    <p className="mt-4 text-sm text-white/70">{errorMsg}</p>
                    <button type="button" onClick={() => window.location.reload()} className="hud-chip mt-6 border border-cyan-300/30 bg-cyan-400/10 px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-cyan-100">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (gameStatus === 'LOADING') {
        return <div className="flex min-h-screen items-center justify-center bg-[#03050c] text-sm font-black uppercase tracking-[0.42em] text-cyan-300/70">Loading Draft Feed...</div>;
    }

    if (gameStatus === 'FILTERING') {
        return (
            <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(244,114,182,0.18),_transparent_22%),linear-gradient(180deg,#03050c_0%,#07101a_42%,#04070f_100%)] px-4 py-10 text-white">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-6 text-center">
                        <div className="text-[10px] font-black uppercase tracking-[0.42em] text-cyan-300/88">Single Player // Deck Setup</div>
                        <h1 className="mt-2 text-4xl font-black uppercase tracking-[0.12em] text-white">Configure The Draft Feed</h1>
                        <p className="mt-3 text-sm text-white/60">Select the universes that can appear in your single-player run.</p>
                    </div>

                    <div className="hud-panel border border-cyan-300/16 bg-[#050c16]/92 p-6">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <ScoreSummaryPanel label="Universes Selected" value={`${selectedUniverses.length}`} tone="cyan" />
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => setSelectedUniverses(availableUniverses)} className="hud-chip border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100">Select All</button>
                                <button type="button" onClick={() => setSelectedUniverses([])} className="hud-chip border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-fuchsia-100">Clear</button>
                            </div>
                        </div>

                        <div className="grid max-h-[460px] grid-cols-1 gap-3 overflow-y-auto pr-2 md:grid-cols-2 xl:grid-cols-3">
                            {availableUniverses.map((universe) => {
                                const selected = selectedUniverses.includes(universe);

                                return (
                                    <button
                                        key={universe}
                                        type="button"
                                        onClick={() => toggleUniverse(universe)}
                                        className={cx('hud-chip flex items-center justify-between border px-4 py-4 text-left transition', selected ? 'border-cyan-300/50 bg-cyan-400/10 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.15)]' : 'border-white/10 bg-[#07111c]/92 text-white/72 hover:border-white/20')}
                                    >
                                        <span className="truncate text-sm font-black uppercase tracking-[0.08em]">{universe}</span>
                                        <span className={cx('ml-3 flex h-6 w-6 items-center justify-center border text-[10px] font-black', selected ? 'border-cyan-200/60 bg-cyan-300 text-black' : 'border-white/16 text-white/35')}>
                                            {selected ? 'ON' : '--'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex flex-col items-center gap-3">
                            <button type="button" onClick={confirmDeck} className="hud-chip border border-yellow-300/50 bg-yellow-300 px-10 py-4 text-lg font-black uppercase tracking-[0.16em] text-black shadow-[0_0_26px_rgba(250,204,21,0.28)] transition hover:scale-[1.02]">
                                Enter The Draft
                            </button>
                            <div className="text-xs uppercase tracking-[0.18em] text-white/45">Verified roster only</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (gameStatus === 'GRADING') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(244,114,182,0.18),_transparent_22%),linear-gradient(180deg,#03050c_0%,#07101a_42%,#04070f_100%)] px-4 text-white">
                <div className="hud-panel w-full max-w-xl border border-cyan-300/20 bg-[#050c16]/92 p-8 text-center">
                    <div className="text-[10px] font-black uppercase tracking-[0.38em] text-cyan-300/82">Battle Feed</div>
                    <h1 className="mt-2 text-4xl font-black uppercase tracking-[0.12em] text-white">Syncing Combat Replay</h1>
                    <p className="mt-4 text-sm uppercase tracking-[0.2em] text-white/54">Routing real battle data into the broadcast lane...</p>
                </div>
            </div>
        );
    }

    if (gameStatus === 'FINISHED' && result && replayScenario) {
        return (
            <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(244,114,182,0.18),_transparent_22%),linear-gradient(180deg,#03050c_0%,#07101a_42%,#04070f_100%)] px-4 py-8 text-white">
                <div className="mx-auto max-w-[1760px]">
                    <div className="mb-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.42em] text-cyan-300/88">Single Player // Battle Feed</div>
                        <h1 className={cx('mt-2 text-4xl font-black uppercase tracking-[0.12em]', result.isWin ? 'text-yellow-300' : 'text-fuchsia-300')}>
                            {result.isWin ? 'Victory Replay' : 'Defeat Replay'}
                        </h1>
                    </div>

                    <BattleReplay
                        scenario={replayScenario}
                        initialMode="single"
                        lockedMode="single"
                        showHeader={false}
                        showModeToggle={false}
                        embedded
                    />

                    <div className="mt-5 grid gap-3 lg:grid-cols-3">
                        <ScoreSummaryPanel label="Your Total" value={`${result.userScore}`} tone="cyan" />
                        <ScoreSummaryPanel label="CPU Total" value={`${result.cpuScore}`} tone="fuchsia" />
                        <ScoreSummaryPanel label="Outcome" value={result.isWin ? 'Win' : 'Loss'} tone="amber" />
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <div className="hud-panel border border-cyan-300/18 bg-[#050c16]/92 px-4 py-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-100">Your Breakdown</div>
                            <div className="mt-2 text-sm text-cyan-100/82">{formatBreakdownSummary(result.userBreakdown)}</div>
                        </div>
                        <div className="hud-panel border border-fuchsia-300/18 bg-[#050c16]/92 px-4 py-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-100">CPU Breakdown</div>
                            <div className="mt-2 text-sm text-fuchsia-100/82">{formatBreakdownSummary(result.cpuBreakdown)}</div>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <button type="button" onClick={handleRematch} className="hud-chip border border-cyan-300/30 bg-cyan-400/12 px-8 py-3 text-sm font-black uppercase tracking-[0.16em] text-cyan-100">
                            Rematch
                        </button>
                        <button type="button" onClick={resetToFilter} className="hud-chip border border-white/12 bg-white/6 px-8 py-3 text-sm font-black uppercase tracking-[0.16em] text-white/86">
                            Change Universes
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const stageHeight = getStageHeight(activeRoles.length);
    const totalStageWidth = (DRAFT_METRICS.squadColumnWidth * 2) + DRAFT_METRICS.laneWidth + (DRAFT_METRICS.stageGap * 2);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(244,114,182,0.18),_transparent_22%),linear-gradient(180deg,#03050c_0%,#07101a_42%,#04070f_100%)] px-4 py-8 text-white">
            <style jsx global>{`
                .hud-panel { position: relative; overflow: hidden; clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px)); box-shadow: 0 0 0 1px rgba(34,211,238,0.12), inset 0 0 0 1px rgba(34,211,238,0.05), 0 18px 44px rgba(0,0,0,0.46); }
                .hud-chip { clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
                .anime-card { clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px)); }
            `}</style>

            <div className="mx-auto max-w-[1760px]">
                <div className="mb-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.42em] text-cyan-300/88">Single Player // Draft Feed</div>
                    <h1 className="mt-1 text-[28px] font-black uppercase tracking-[0.14em] text-white">Anime Draft Broadcast</h1>
                </div>

                <div className="mx-auto mb-6 max-w-3xl">
                    <div className="hud-panel border border-cyan-300/18 bg-[#050c16]/92 px-6 py-4 text-center">
                        <div className="text-[9px] font-black uppercase tracking-[0.34em] text-cyan-100/74">Current Draw</div>
                        {!currentDraw && !isGameFull && isUserTurn && (
                            <button type="button" onClick={handleUserSummon} className="hud-chip mt-4 border border-yellow-300/50 bg-yellow-300 px-10 py-4 text-lg font-black uppercase tracking-[0.16em] text-black shadow-[0_0_26px_rgba(250,204,21,0.28)]">
                                Summon
                            </button>
                        )}
                        {currentDraw && (
                            <div className="mt-4 flex flex-col items-center gap-4">
                                <SquadSlot char={currentDraw} role={activeRoles[0]} accent="cyan" emptyLabel="" showRoleStars={false} />
                                <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                                    <span className="hud-chip border border-cyan-300/18 bg-cyan-400/10 px-3 py-1 text-cyan-100">{currentDraw.animeUniverse}</span>
                                    <span className="hud-chip border border-white/12 bg-white/6 px-3 py-1 text-white/75">{currentDraw.stats.favorites.toLocaleString()} favorites</span>
                                    <span className="hud-chip border border-fuchsia-300/18 bg-fuchsia-400/10 px-3 py-1 text-fuchsia-100">Skips {skipsRemaining}/{MAX_SKIPS}</span>
                                </div>
                                <button type="button" onClick={handleSkip} disabled={skipsRemaining <= 0} className="hud-chip border border-fuchsia-300/24 bg-fuchsia-400/10 px-5 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-fuchsia-100 disabled:opacity-40">
                                    Skip Draw
                                </button>
                            </div>
                        )}
                        {!isUserTurn && !isGameFull && <div className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-fuchsia-200/80">Enemy drafting...</div>}
                        {isGameFull && (
                            <button type="button" onClick={handleGameEnd} className="hud-chip mt-4 border border-cyan-300/40 bg-cyan-300 px-8 py-4 text-lg font-black uppercase tracking-[0.16em] text-black">
                                Begin Battle
                            </button>
                        )}
                    </div>
                </div>

                <div className="relative">
                    <div className="hidden xl:absolute xl:left-4 xl:top-16 xl:z-30 xl:block xl:w-[94px]">
                        <DraftSynergyRail synergies={liveSynergies} />
                    </div>

                    <div className="xl:pl-[110px]">
                        <div className="hud-panel overflow-x-auto border border-cyan-300/16 bg-[#040913]/92 p-4">
                            <div
                                className="grid items-start"
                                style={{
                                    minWidth: totalStageWidth,
                                    gridTemplateColumns: `${DRAFT_METRICS.squadColumnWidth}px ${DRAFT_METRICS.laneWidth}px ${DRAFT_METRICS.squadColumnWidth}px`,
                                    gap: DRAFT_METRICS.stageGap,
                                }}
                            >
                                <div className={cx('relative z-10 flex flex-col px-3 py-3 transition duration-300', isUserTurn ? 'opacity-100' : 'opacity-45 saturate-50')} style={{ minHeight: stageHeight }}>
                                    <div className={cx('relative h-full border px-6 py-3 transition duration-300', isUserTurn ? 'border-cyan-300/34 bg-[linear-gradient(180deg,rgba(7,24,38,0.96),rgba(5,12,20,0.94))] shadow-[0_0_28px_rgba(34,211,238,0.16)]' : 'border-cyan-300/12 bg-[linear-gradient(180deg,rgba(7,16,27,0.84),rgba(5,9,16,0.78))]')}>
                                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(34,211,238,0.06),transparent_32%,transparent_74%,rgba(217,70,239,0.08))]" />
                                        <div className="relative mb-3 flex items-end justify-between" style={{ height: DRAFT_METRICS.headerHeight }}>
                                            <div>
                                                <div className="text-[10px] font-black uppercase tracking-[0.36em] text-cyan-300/88">Your Squad</div>
                                                <div className="mt-1 text-sm font-black uppercase tracking-[0.14em] text-cyan-100">{isUserTurn ? 'Active' : 'Standby'}</div>
                                            </div>
                                        </div>
                                        <div className="relative flex flex-col items-center" style={{ gap: DRAFT_METRICS.rowGap }}>
                                            {userTeam.map((char, index) => (
                                                <SquadSlot
                                                    key={`user-${index}`}
                                                    char={char}
                                                    role={activeRoles[index]}
                                                    accent="cyan"
                                                    emptyLabel={currentDraw && isUserTurn ? 'Lock In' : 'Empty'}
                                                    clickable={Boolean(currentDraw && isUserTurn && !char)}
                                                    onClick={() => handleSlotClick(index)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <RoleLane activeRoles={activeRoles} />

                                <div className={cx('relative z-10 flex flex-col px-3 py-3 transition duration-300', !isUserTurn ? 'opacity-100' : 'opacity-45 saturate-50')} style={{ minHeight: stageHeight }}>
                                    <div className={cx('relative h-full border px-6 py-3 transition duration-300', !isUserTurn ? 'border-fuchsia-300/34 bg-[linear-gradient(180deg,rgba(22,9,28,0.96),rgba(7,10,18,0.92))] shadow-[0_0_28px_rgba(217,70,239,0.14)]' : 'border-fuchsia-300/12 bg-[linear-gradient(180deg,rgba(17,8,21,0.82),rgba(6,8,15,0.76))]')}>
                                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(34,211,238,0.04),transparent_32%,transparent_74%,rgba(217,70,239,0.10))]" />
                                        <div className="relative mb-3 flex items-end justify-between" style={{ height: DRAFT_METRICS.headerHeight }}>
                                            <div>
                                                <div className="text-[10px] font-black uppercase tracking-[0.36em] text-fuchsia-300/88">Enemy Squad</div>
                                                <div className="mt-1 text-sm font-black uppercase tracking-[0.14em] text-fuchsia-100">{!isUserTurn ? 'Active' : 'Standby'}</div>
                                            </div>
                                        </div>
                                        <div className="relative flex flex-col items-center" style={{ gap: DRAFT_METRICS.rowGap }}>
                                            {cpuTeam.map((char, index) => (
                                                <SquadSlot key={`cpu-${index}`} char={char} role={activeRoles[index]} accent="fuchsia" emptyLabel="Waiting" showReason={false} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
