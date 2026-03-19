'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBaseStarMap, mockReplayScenario } from '@/components/battle-replay/mockData';
import type { BattleReplayProps, ModifierKind, ReplayEvent, ReplayMode, RoleKey, SquadDefinition, SquadEntry, SynergyRow } from '@/components/battle-replay/types';
import { HUD_METRICS, ROLES } from '@/components/battle-replay/types';

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ');
}

function roleLabel(role: RoleKey) {
    switch (role) {
        case 'captain': return 'Captain';
        case 'viceCaptain': return 'Vice Captain';
        case 'tank': return 'Tank';
        case 'duelist': return 'Duelist';
        case 'support': return 'Support';
        case 'traitor': return 'Traitor';
    }
}

function toneClasses(tone: SynergyRow['tone']) {
    switch (tone) {
        case 'cyan': return 'border-cyan-300/45 bg-cyan-400/10 text-cyan-100';
        case 'sky': return 'border-sky-300/45 bg-sky-400/10 text-sky-100';
        case 'emerald': return 'border-emerald-300/45 bg-emerald-400/10 text-emerald-100';
        case 'teal': return 'border-teal-300/45 bg-teal-400/10 text-teal-100';
        case 'amber': return 'border-amber-300/45 bg-amber-400/10 text-amber-100';
        case 'yellow': return 'border-yellow-300/45 bg-yellow-400/10 text-yellow-100';
        case 'fuchsia': return 'border-fuchsia-300/45 bg-fuchsia-400/10 text-fuchsia-100';
        default: return 'border-white/15 bg-white/5 text-white';
    }
}

function getCardInset() {
    return HUD_METRICS.squadPaddingX + ((HUD_METRICS.squadColumnWidth - (HUD_METRICS.squadPaddingX * 2) - HUD_METRICS.cardWidth) / 2);
}

function getLaneExtents(opponentCount: number) {
    const leftCardInset = getCardInset();
    const leftReach = HUD_METRICS.squadColumnWidth + HUD_METRICS.stageGap - leftCardInset;
    const rightCardEdge = getCardInset() + HUD_METRICS.cardWidth;
    const rightReach = HUD_METRICS.stageGap + ((Math.max(1, opponentCount) - 1) * (HUD_METRICS.squadColumnWidth + HUD_METRICS.stageGap)) + rightCardEdge;
    return { leftReach, rightReach };
}

function buildEntries(cards: SquadDefinition['cards']) {
    return cards.map((card, index) => ({ role: ROLES[index], card }));
}

function getTraitor(entries: SquadEntry[]) {
    return entries.find((entry) => entry.role === 'traitor')?.card ?? null;
}

function applyTraitorSwap(entries: SquadEntry[], incomingTraitor: SquadEntry['card'] | null, enabled: boolean) {
    if (!enabled || !incomingTraitor) return entries;
    return entries.map((entry) => (entry.role === 'traitor' ? { ...entry, card: incomingTraitor } : entry));
}

function iconGlyph(type: 'play' | 'pause' | 'step' | 'replay') {
    switch (type) {
        case 'play':
            return <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 fill-current"><path d="M2 1.4 10 6 2 10.6Z" /></svg>;
        case 'pause':
            return <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 fill-current"><path d="M2 1h3v10H2Zm5 0h3v10H7Z" /></svg>;
        case 'step':
            return <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 fill-current"><path d="M2 1.5 7 6 2 10.5Zm5 0h1.8v9H7Z" /></svg>;
        case 'replay':
            return <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 fill-current"><path d="M6 1a5 5 0 1 0 4.68 6.78h-1.7A3.5 3.5 0 1 1 6 2.5V4L9 1 6 0Z" /></svg>;
    }
}

function ControlButton({ icon, label, active, onClick }: { icon: 'play' | 'pause' | 'step' | 'replay'; label: string; active?: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className={cx('hud-chip inline-flex items-center gap-1.5 border px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] transition', active ? 'border-cyan-200 bg-cyan-300 text-black shadow-[0_0_24px_rgba(34,211,238,0.25)]' : 'border-white/10 bg-white/6 text-white/82 hover:bg-white/10')}>
            {iconGlyph(icon)}
            <span>{label}</span>
        </button>
    );
}

function ScorePanel({ label, value, tone, flash }: { label: string; value: number; tone: 'cyan' | 'fuchsia' | 'amber'; flash: boolean }) {
    const toneClass = tone === 'cyan' ? 'border-cyan-300/25 bg-[#081120]/92 text-cyan-100' : tone === 'fuchsia' ? 'border-fuchsia-300/25 bg-[#081120]/92 text-fuchsia-100' : 'border-yellow-300/35 bg-[#081120]/92 text-yellow-100';
    return (
        <div className={cx('hud-panel px-4 py-3 transition duration-200', toneClass, flash && 'scale-[1.02] shadow-[0_0_28px_rgba(34,211,238,0.18)]')}>
            <div className="text-[9px] font-black uppercase tracking-[0.34em] text-white/55">{label}</div>
            <div className="mt-1 text-[22px] font-black uppercase tracking-[0.08em]">{value}</div>
        </div>
    );
}

function SynergyRail({ align, rows }: { align: 'left' | 'right'; rows: SynergyRow[] }) {
    return (
        <div className={cx('pointer-events-none absolute top-12 z-20 flex flex-col gap-2', align === 'left' ? 'left-0 -translate-x-1/3 items-start' : 'right-0 translate-x-1/3 items-end')}>
            {rows.map((row) => (
                <div key={`${row.label}-${row.progress}`} title={`${row.label}: ${row.hint}`} className="pointer-events-auto group relative">
                    <div className="hud-chip flex items-center gap-1.5 border border-white/8 bg-[#09111d]/95 px-1.5 py-1 shadow-[0_8px_18px_rgba(0,0,0,0.36)]">
                        <div className={cx('hud-chip min-w-[30px] border px-1.5 py-1 text-center text-[8px] font-black uppercase tracking-[0.1em]', toneClasses(row.tone))}>{row.symbol}</div>
                        <div className={cx('w-[76px] leading-tight', align === 'left' ? 'text-left' : 'text-right')}>
                            <div className="truncate text-[8px] font-black uppercase tracking-[0.08em] text-white/90">{row.label}</div>
                            <div className="truncate text-[8px] text-white/45">{row.progress}</div>
                        </div>
                    </div>
                    <div className={cx('pointer-events-none absolute top-1/2 z-30 hidden max-w-[180px] -translate-y-1/2 border border-cyan-300/20 bg-[#040b14]/95 px-2 py-1.5 text-[10px] leading-snug text-white/82 shadow-[0_10px_22px_rgba(0,0,0,0.42)] group-hover:block', align === 'left' ? 'left-full ml-2' : 'right-full mr-2')}>{row.hint}</div>
                </div>
            ))}
        </div>
    );
}

function CardTile({
    card, role, side, currentStars, activeRole, isActor, isTarget, modifierKind, resultState, fear, starPopup, traitorDefected,
}: {
    card: SquadEntry['card'];
    role: RoleKey;
    side: 'left' | 'right';
    currentStars: number;
    activeRole?: RoleKey;
    isActor: boolean;
    isTarget: boolean;
    modifierKind?: ModifierKind | null;
    resultState?: 'win' | 'lose' | null;
    fear?: boolean;
    starPopup?: number | null;
    traitorDefected?: boolean;
}) {
    const isActiveRow = activeRole === role;
    const lungeClass = isActor ? (side === 'left' ? 'translate-x-5 scale-[1.04]' : '-translate-x-5 scale-[1.04]') : '';

    return (
        <div className="relative z-20 flex items-center justify-center" style={{ height: HUD_METRICS.cardHeight }}>
            {typeof starPopup === 'number' && (
                <div className={cx('absolute left-1/2 top-0 z-40 -translate-x-1/2 -translate-y-1/2 border px-2 py-1 text-[10px] font-black shadow-[0_0_18px_rgba(255,255,255,0.16)]', starPopup > 0 ? 'border-cyan-200/60 bg-cyan-300 text-black' : 'border-fuchsia-200/60 bg-fuchsia-400 text-black')}>
                    {starPopup > 0 ? `+${starPopup}★` : `${starPopup}★`}
                </div>
            )}
            <div className={cx('anime-card relative overflow-hidden border bg-black/80 transition-all duration-300 ease-out', isActiveRow ? 'border-cyan-300/50 shadow-[0_0_26px_rgba(34,211,238,0.16)]' : 'border-white/12', isTarget && 'animate-[battle-shake_240ms_linear_1]', fear && 'animate-[fear-shiver_360ms_ease-in-out_2]', lungeClass, resultState === 'win' && 'ring-1 ring-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.26)]', resultState === 'lose' && 'opacity-60 saturate-50')} style={{ width: HUD_METRICS.cardWidth, height: HUD_METRICS.cardHeight }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover contrast-110 saturate-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(34,211,238,0.14),transparent_30%,transparent_70%,rgba(217,70,239,0.16))]" />
                <div className="absolute left-0 top-0 h-5 w-5 border-l-[3px] border-t-[3px] border-cyan-300/60" />
                <div className="absolute bottom-0 right-0 h-5 w-5 border-b-[3px] border-r-[3px] border-fuchsia-300/55" />
                <div className="absolute left-0 top-0 h-[2px] w-full bg-cyan-300/75" />
                {modifierKind === 'support' && <div className="absolute inset-0 animate-pulse border border-cyan-200/80 bg-cyan-300/10" />}
                {modifierKind === 'aura' && <div className="absolute inset-0 animate-pulse border border-violet-200/80 bg-violet-400/12" />}
                {modifierKind === 'traitor' && <div className="absolute inset-0 animate-pulse border border-fuchsia-200/80 bg-fuchsia-400/12" />}
                <div className={cx('absolute right-1.5 top-1.5 border px-1.5 py-1 text-[8px] font-black shadow-lg', modifierKind === 'aura' || modifierKind === 'traitor' ? 'border-fuchsia-200/50 bg-fuchsia-300 text-black' : 'border-yellow-100/70 bg-yellow-300 text-black')}>★{currentStars}</div>
                <div className="absolute inset-x-1.5 bottom-1.5 bg-black/42 px-1.5 py-1">
                    <div className="truncate text-[9px] font-black leading-none text-white">{card.name}</div>
                    <div className="mt-0.5 truncate text-[8px] uppercase tracking-[0.12em] text-white/60">{card.animeUniverse}</div>
                </div>
                {traitorDefected && role === 'traitor' && <div className="absolute inset-x-2 bottom-9 border border-fuchsia-300/40 bg-fuchsia-400/16 px-1.5 py-1 text-center text-[7px] font-black uppercase tracking-[0.16em] text-fuchsia-100">Defected</div>}
            </div>
        </div>
    );
}

function SquadColumn({
    squad, side, entries, activeRole, currentStars, actorId, targetId, currentEvent, score, isFocusedTarget, scoreFlash, starPopupTargetId, starPopupValue,
}: {
    squad: SquadDefinition;
    side: 'left' | 'right';
    entries: SquadEntry[];
    activeRole?: RoleKey;
    currentStars: Record<number, number>;
    actorId?: number;
    targetId?: number;
    currentEvent: ReplayEvent | null;
    score: number;
    isFocusedTarget: boolean;
    scoreFlash: boolean;
    starPopupTargetId: number | null;
    starPopupValue: number | null;
}) {
    return (
        <div className="relative z-10 flex min-h-[900px] flex-col px-3 py-3">
            <SynergyRail align={side} rows={squad.synergies} />
            <div className="hud-panel relative h-full border border-white/8 bg-[#050c16]/92 px-6 py-3">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(34,211,238,0.08),transparent_32%,transparent_70%,rgba(217,70,239,0.08))]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-300/0 via-cyan-300/70 to-fuchsia-300/0" />
                <div className={cx('relative z-20 mb-3 flex items-center justify-between', side === 'left' ? 'text-left' : 'text-right')} style={{ height: HUD_METRICS.headerHeight }}>
                    <div>
                        <div className={cx('text-[10px] font-black uppercase tracking-[0.36em]', squad.accent === 'cyan' ? 'text-cyan-300/88' : 'text-fuchsia-300/88')}>{squad.title}</div>
                        <div className="mt-1 text-[16px] font-black uppercase tracking-[0.08em] text-white">{squad.id === 'player' ? 'Carl P' : squad.id.replace('enemy-', 'Guest ')}</div>
                    </div>
                    <div className={cx('hud-chip border px-3 py-2 text-[18px] font-black transition', squad.accent === 'cyan' ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100' : 'border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-100', scoreFlash && 'scale-105 shadow-[0_0_26px_rgba(34,211,238,0.20)]')}>{score}</div>
                </div>
                <div className={cx('relative z-20 flex flex-col items-center', isFocusedTarget && side === 'right' ? 'drop-shadow-[0_0_18px_rgba(244,114,182,0.18)]' : '')} style={{ gap: HUD_METRICS.rowGap }}>
                    {entries.map(({ role, card }) => {
                        const modifier = currentEvent?.type === 'modifier' && (currentEvent.actorId === card.id || currentEvent.targetId === card.id) ? currentEvent.modifierKind ?? null : null;
                        const result = currentEvent?.type === 'score' && currentEvent.role === role ? (currentEvent.winnerSquadId === squad.id ? 'win' : currentEvent.winnerSquadId ? 'lose' : null) : null;
                        const fear = currentEvent?.type === 'modifier' && currentEvent.targetId === card.id && (currentEvent.modifierKind === 'aura' || currentEvent.modifierKind === 'traitor');
                        return (
                            <CardTile
                                key={`${squad.id}-${role}-${card.id}`}
                                card={card}
                                role={role}
                                side={side}
                                currentStars={currentStars[card.id] ?? card.stars}
                                activeRole={activeRole}
                                isActor={actorId === card.id}
                                isTarget={targetId === card.id}
                                modifierKind={modifier}
                                resultState={result}
                                fear={fear}
                                starPopup={starPopupTargetId === card.id ? starPopupValue : null}
                                traitorDefected={Boolean(currentEvent && currentEvent.phase !== 'pre-battle')}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function RoleLane({ activeRole, opponentCount }: { activeRole?: RoleKey; opponentCount: number }) {
    const { leftReach, rightReach } = getLaneExtents(opponentCount);
    return (
        <div className="relative z-0 flex min-h-[900px] flex-col border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(5,11,20,0.98),rgba(2,7,15,0.98))] px-3 py-3 shadow-[0_20px_44px_rgba(0,0,0,0.46)]" style={{ overflow: 'visible' }}>
            <div className="mb-3 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.42em] text-cyan-300/78" style={{ height: HUD_METRICS.headerHeight }}>Battle Lane</div>
            <div className="flex flex-col items-center" style={{ gap: HUD_METRICS.rowGap }}>
                {ROLES.map((role) => {
                    const isActive = activeRole === role;
                    const isTraitor = role === 'traitor';
                    const bandClass = isActive ? (isTraitor ? 'border-fuchsia-300/50 bg-[linear-gradient(90deg,rgba(244,114,182,0.14),rgba(4,10,18,0.02),rgba(244,114,182,0.14))]' : 'border-cyan-300/50 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(4,10,18,0.02),rgba(34,211,238,0.14))]') : (isTraitor ? 'border-fuchsia-300/14 bg-[linear-gradient(90deg,rgba(244,114,182,0.04),transparent,rgba(244,114,182,0.04))]' : 'border-white/10 bg-[linear-gradient(90deg,rgba(255,255,255,0.03),transparent,rgba(255,255,255,0.03))]');
                    const lineClass = isActive ? (isTraitor ? 'bg-fuchsia-300/85 shadow-[0_0_12px_rgba(244,114,182,0.26)]' : 'bg-cyan-300/85 shadow-[0_0_12px_rgba(34,211,238,0.26)]') : (isTraitor ? 'bg-fuchsia-300/30' : 'bg-white/16');
                    const labelClass = isActive ? (isTraitor ? 'border-fuchsia-300 bg-fuchsia-400/14 text-fuchsia-100 shadow-[0_0_18px_rgba(244,114,182,0.18)]' : 'border-cyan-300 bg-cyan-400/12 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)]') : (isTraitor ? 'border-fuchsia-300/20 bg-[#0b1322] text-fuchsia-200/70' : 'border-white/10 bg-[#0b1322] text-white/56');
                    return (
                        <div key={role} className="relative flex w-full items-center justify-center" style={{ height: HUD_METRICS.cardHeight, overflow: 'visible' }}>
                            <div className={cx('pointer-events-none absolute top-1/2 h-[118px] -translate-y-1/2 border-y', bandClass)} style={{ left: -leftReach, right: -rightReach }} />
                            <div className={cx('pointer-events-none absolute top-1/2 h-px -translate-y-1/2', lineClass)} style={{ left: -leftReach, right: -rightReach }} />
                            <div className={cx('hud-chip relative z-20 border px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.12em]', labelClass)}>{roleLabel(role)}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function BattleLog({ visibleLogs, activeIndex, totalEvents, dock }: { visibleLogs: string[]; activeIndex: number; totalEvents: number; dock: 'side' | 'bottom' }) {
    return (
        <div className="hud-panel border border-fuchsia-300/20 bg-[#050c16]/96 p-3 shadow-[0_20px_44px_rgba(0,0,0,0.46)]">
            <div className="mb-2.5 flex items-start justify-between gap-3">
                <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-white/50">Synced Battle Log</div>
                    <div className="mt-1 text-[15px] font-black uppercase tracking-[0.14em] text-cyan-100">Broadcast Feed</div>
                </div>
                <div className="hud-chip border border-cyan-300/14 bg-white/5 px-2 py-1 text-[9px] text-white/72">Event {Math.max(activeIndex + 1, 0)} / {totalEvents}</div>
            </div>
            <div className="space-y-1.5 overflow-y-auto border border-cyan-300/10 bg-[#060b14]/98 p-2.5 font-mono text-[11px]" style={{ height: dock === 'side' ? 852 : 280 }}>
                {visibleLogs.map((log, index) => {
                    const isLatest = index === visibleLogs.length - 1;
                    return <div key={`${log}-${index}`} className={cx('hud-chip border px-2.5 py-2 transition-all', isLatest ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-50' : 'border-white/6 bg-[#0a1220]/92 text-white/78')}>{log}</div>;
                })}
            </div>
        </div>
    );
}

export default function BattleReplay({ scenario = mockReplayScenario, initialMode = 'single' }: BattleReplayProps) {
    const [mode, setMode] = useState<ReplayMode>(initialMode);
    const [isPlaying, setIsPlaying] = useState(true);
    const [speed, setSpeed] = useState<1 | 2 | 4>(1);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
    const [starMap, setStarMap] = useState<Record<number, number>>(() => createBaseStarMap(scenario));
    const [scoreMap, setScoreMap] = useState<Record<string, number>>(() => ({ [scenario.player.id]: 0, ...Object.fromEntries(scenario.opponents.map((opponent) => [opponent.id, 0])) }));
    const [scoreFlashSquadId, setScoreFlashSquadId] = useState<string | null>(null);
    const [starPopupTargetId, setStarPopupTargetId] = useState<number | null>(null);
    const [starPopupValue, setStarPopupValue] = useState<number | null>(null);
    const [currentTargetSquadId, setCurrentTargetSquadId] = useState<string>(scenario.opponents[0]?.id ?? '');

    const visibleOpponents = useMemo(() => (mode === 'single' ? scenario.opponents.slice(0, 1) : scenario.opponents), [mode, scenario.opponents]);
    const currentEvent = activeIndex >= 0 ? scenario.events[activeIndex] : null;
    const combatStartIndex = useMemo(() => scenario.events.findIndex((event) => event.type === 'phase-start' && event.phase === 'combat'), [scenario.events]);
    const combatStarted = combatStartIndex !== -1 && activeIndex >= combatStartIndex;
    const focusedOpponent = visibleOpponents.find((opponent) => opponent.id === currentTargetSquadId) ?? visibleOpponents[0];

    const playerEntries = useMemo(() => applyTraitorSwap(buildEntries(scenario.player.cards), focusedOpponent ? getTraitor(buildEntries(focusedOpponent.cards)) : null, combatStarted), [combatStarted, focusedOpponent, scenario.player.cards]);
    const opponentEntriesById = useMemo(() => {
        const playerTraitor = getTraitor(buildEntries(scenario.player.cards));
        return Object.fromEntries(visibleOpponents.map((opponent) => [opponent.id, opponent.id === currentTargetSquadId ? applyTraitorSwap(buildEntries(opponent.cards), playerTraitor, combatStarted) : buildEntries(opponent.cards)])) as Record<string, SquadEntry[]>;
    }, [combatStarted, currentTargetSquadId, scenario.player.cards, visibleOpponents]);

    useEffect(() => {
        setCurrentTargetSquadId(visibleOpponents[0]?.id ?? '');
    }, [mode, visibleOpponents]);

    useEffect(() => {
        if (!isPlaying || activeIndex >= scenario.events.length - 1) return;
        const nextEvent = scenario.events[activeIndex + 1];
        const timer = setTimeout(() => setActiveIndex((index) => Math.min(index + 1, scenario.events.length - 1)), (nextEvent?.duration ?? 900) / speed);
        return () => clearTimeout(timer);
    }, [activeIndex, isPlaying, scenario.events, speed]);

    useEffect(() => {
        if (!currentEvent) return;
        setVisibleLogs((prev) => [...prev, currentEvent.text]);
        if (currentEvent.targetSquadId) setCurrentTargetSquadId(currentEvent.targetSquadId);

        if (currentEvent.type === 'modifier' && currentEvent.targetId && typeof currentEvent.starDelta === 'number') {
            const targetId = currentEvent.targetId;
            const starDelta = currentEvent.starDelta;
            setStarMap((prev) => ({ ...prev, [targetId]: Math.max(0, (prev[targetId] ?? 0) + starDelta) }));
            setStarPopupTargetId(targetId);
            setStarPopupValue(starDelta);
            const popupTimer = setTimeout(() => {
                setStarPopupTargetId(null);
                setStarPopupValue(null);
            }, 780);
            return () => clearTimeout(popupTimer);
        }

        if (currentEvent.type === 'score' && currentEvent.winnerSquadId) {
            setScoreMap((prev) => ({ ...prev, [currentEvent.winnerSquadId as string]: (prev[currentEvent.winnerSquadId as string] ?? 0) + (currentEvent.delta ?? 1) }));
            setScoreFlashSquadId(currentEvent.winnerSquadId);
            const flashTimer = setTimeout(() => setScoreFlashSquadId(null), 320);
            return () => clearTimeout(flashTimer);
        }

        return undefined;
    }, [currentEvent]);

    function resetReplay(shouldPlay = false) {
        setIsPlaying(shouldPlay);
        setActiveIndex(-1);
        setVisibleLogs([]);
        setStarMap(createBaseStarMap(scenario));
        setScoreMap({ [scenario.player.id]: 0, ...Object.fromEntries(scenario.opponents.map((opponent) => [opponent.id, 0])) });
        setScoreFlashSquadId(null);
        setStarPopupTargetId(null);
        setStarPopupValue(null);
        setCurrentTargetSquadId(scenario.opponents[0]?.id ?? '');
    }

    const totalStageWidth = HUD_METRICS.squadColumnWidth + HUD_METRICS.laneWidth + (visibleOpponents.length * HUD_METRICS.squadColumnWidth) + ((visibleOpponents.length + 1) * HUD_METRICS.stageGap) + (mode === 'single' ? HUD_METRICS.logWidth + HUD_METRICS.stageGap : 0);

    return (
        <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(244,114,182,0.18),_transparent_22%),linear-gradient(180deg,#03050c_0%,#07101a_42%,#04070f_100%)] text-white">
            <style jsx global>{`
                @keyframes battle-shake { 0% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-4px); } 100% { transform: translateX(0); } }
                @keyframes fear-shiver { 0%,100% { transform: translateX(0) scale(1); } 20% { transform: translateX(-2px) translateY(-2px) scale(0.985); } 40% { transform: translateX(2px) translateY(1px) scale(0.985); } 60% { transform: translateX(-2px) translateY(0) scale(0.985); } 80% { transform: translateX(2px) translateY(-1px) scale(0.985); } }
                @keyframes scanline { 0% { transform: translateY(-120%); } 100% { transform: translateY(120vh); } }
                .hud-panel { position: relative; overflow: hidden; clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px)); box-shadow: 0 0 0 1px rgba(34,211,238,0.12), inset 0 0 0 1px rgba(34,211,238,0.05), 0 18px 44px rgba(0,0,0,0.46); }
                .hud-chip { clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
                .anime-card { clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px)); }
            `}</style>
            <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(34,211,238,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.04)_1px,transparent_1px)] [background-size:72px_72px]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[170px] animate-[scanline_8s_linear_infinite] bg-gradient-to-b from-transparent via-cyan-300/8 to-transparent" />
            <div className="relative z-10 mx-auto max-w-[1680px] p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.42em] text-cyan-300/88">Anime Ops // Battle Replay</div>
                        <h1 className="mt-1 text-[28px] font-black uppercase tracking-[0.14em] text-white">{mode === 'single' ? 'Single Battle Stage' : 'Multiplayer Combat Feed'}</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="hud-panel flex items-center bg-[#07101d]/92 p-1">
                            <button type="button" onClick={() => { setMode('single'); resetReplay(true); }} className={cx('hud-chip px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] transition', mode === 'single' ? 'bg-cyan-300 text-black' : 'bg-white/5 text-white/75 hover:bg-cyan-400/10')}>Single</button>
                            <button type="button" onClick={() => { setMode('multiplayer'); resetReplay(true); }} className={cx('hud-chip px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] transition', mode === 'multiplayer' ? 'bg-fuchsia-300 text-black' : 'bg-white/5 text-white/75 hover:bg-fuchsia-400/10')}>Multiplayer</button>
                        </div>
                        <div className="hud-panel flex items-center gap-1.5 bg-[#07101d]/92 p-1.5">
                            <ControlButton icon="play" label="Play" active={isPlaying} onClick={() => setIsPlaying(true)} />
                            <ControlButton icon="pause" label="Pause" onClick={() => setIsPlaying(false)} />
                            <ControlButton icon="step" label="Step" onClick={() => { setIsPlaying(false); setActiveIndex((index) => Math.min(index + 1, scenario.events.length - 1)); }} />
                            <ControlButton icon="replay" label="Replay" onClick={() => resetReplay(true)} />
                            <div className="hud-chip ml-1 flex items-center gap-1 bg-black/25 p-1">
                                {[1, 2, 4].map((value) => (
                                    <button key={value} type="button" onClick={() => setSpeed(value as 1 | 2 | 4)} className={cx('hud-chip px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em]', speed === value ? 'bg-yellow-300 text-black' : 'text-white/70 hover:bg-white/10')}>x{value}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mb-4 grid gap-4 md:grid-cols-[220px_1fr_220px]">
                    <ScorePanel label="Your Score" value={scoreMap[scenario.player.id] ?? 0} tone="cyan" flash={scoreFlashSquadId === scenario.player.id} />
                    <div className="hud-panel border border-yellow-300/30 bg-[linear-gradient(90deg,rgba(251,191,36,0.18),rgba(34,211,238,0.08),rgba(217,70,239,0.12))] px-4 py-3 text-center">
                        <div className="text-[9px] font-black uppercase tracking-[0.34em] text-yellow-100/72">Current Broadcast</div>
                        <div className="mt-1 text-[16px] font-black uppercase tracking-[0.06em] text-yellow-100">{currentEvent?.text ?? 'Ready to replay'}</div>
                    </div>
                    <ScorePanel label="Focused Enemy" value={focusedOpponent ? scoreMap[focusedOpponent.id] ?? 0 : 0} tone="fuchsia" flash={Boolean(focusedOpponent && scoreFlashSquadId === focusedOpponent.id)} />
                </div>
                <div className="space-y-4">
                    <div className="hud-panel overflow-x-auto border border-cyan-300/16 bg-[#040913]/92 p-4">
                        {mode === 'single' ? (
                            <div className="grid items-start" style={{ minWidth: totalStageWidth, gridTemplateColumns: `${HUD_METRICS.squadColumnWidth}px ${HUD_METRICS.laneWidth}px ${HUD_METRICS.squadColumnWidth}px ${HUD_METRICS.logWidth}px`, gap: HUD_METRICS.stageGap }}>
                                <SquadColumn squad={scenario.player} side="left" entries={playerEntries} activeRole={currentEvent?.role} currentStars={starMap} actorId={currentEvent?.actorId} targetId={currentEvent?.targetId} currentEvent={currentEvent} score={scoreMap[scenario.player.id] ?? 0} isFocusedTarget={false} scoreFlash={scoreFlashSquadId === scenario.player.id} starPopupTargetId={starPopupTargetId} starPopupValue={starPopupValue} />
                                <RoleLane activeRole={currentEvent?.role} opponentCount={1} />
                                {focusedOpponent && <SquadColumn squad={focusedOpponent} side="right" entries={opponentEntriesById[focusedOpponent.id] ?? buildEntries(focusedOpponent.cards)} activeRole={currentEvent?.role} currentStars={starMap} actorId={currentEvent?.actorId} targetId={currentEvent?.targetId} currentEvent={currentEvent} score={scoreMap[focusedOpponent.id] ?? 0} isFocusedTarget scoreFlash={scoreFlashSquadId === focusedOpponent.id} starPopupTargetId={starPopupTargetId} starPopupValue={starPopupValue} />}
                                <div className="min-h-[900px]"><BattleLog visibleLogs={visibleLogs} activeIndex={activeIndex} totalEvents={scenario.events.length} dock="side" /></div>
                            </div>
                        ) : (
                            <div className="grid items-start" style={{ minWidth: totalStageWidth, gridTemplateColumns: `${HUD_METRICS.squadColumnWidth}px ${HUD_METRICS.laneWidth}px repeat(${visibleOpponents.length}, ${HUD_METRICS.squadColumnWidth}px)`, gap: HUD_METRICS.stageGap }}>
                                <SquadColumn squad={scenario.player} side="left" entries={playerEntries} activeRole={currentEvent?.role} currentStars={starMap} actorId={currentEvent?.actorId} targetId={currentEvent?.targetId} currentEvent={currentEvent} score={scoreMap[scenario.player.id] ?? 0} isFocusedTarget={false} scoreFlash={scoreFlashSquadId === scenario.player.id} starPopupTargetId={starPopupTargetId} starPopupValue={starPopupValue} />
                                <RoleLane activeRole={currentEvent?.role} opponentCount={visibleOpponents.length} />
                                {visibleOpponents.map((opponent) => (
                                    <SquadColumn key={opponent.id} squad={opponent} side="right" entries={opponentEntriesById[opponent.id] ?? buildEntries(opponent.cards)} activeRole={currentEvent?.role} currentStars={starMap} actorId={currentEvent?.actorId} targetId={currentEvent?.targetId} currentEvent={currentEvent} score={scoreMap[opponent.id] ?? 0} isFocusedTarget={opponent.id === focusedOpponent?.id} scoreFlash={scoreFlashSquadId === opponent.id} starPopupTargetId={starPopupTargetId} starPopupValue={starPopupValue} />
                                ))}
                            </div>
                        )}
                    </div>
                    {mode === 'multiplayer' && <BattleLog visibleLogs={visibleLogs} activeIndex={activeIndex} totalEvents={scenario.events.length} dock="bottom" />}
                </div>
            </div>
        </div>
    );
}
