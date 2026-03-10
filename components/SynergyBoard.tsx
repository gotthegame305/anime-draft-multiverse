'use client';

import { useMemo, useState } from 'react';
import type { SynergyProgress } from '@/lib/synergyBoard';

interface SynergyBoardProps {
    synergies: SynergyProgress[];
    title?: string;
    emptyText?: string;
    className?: string;
    variant?: 'default' | 'compact';
}

const toneClasses = {
    partial: {
        row: 'border-slate-700 bg-slate-900/80 hover:border-cyan-400/60',
        badge: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200',
        progress: 'text-cyan-200',
        status: 'text-slate-400',
    },
    completed: {
        row: 'border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-300',
        badge: 'border-emerald-300/60 bg-emerald-500/20 text-emerald-100',
        progress: 'text-emerald-200',
        status: 'text-emerald-300',
    },
} as const;

export default function SynergyBoard({
    synergies,
    title = 'Synergy Board',
    emptyText = 'No live synergies yet. Place cards to start lines.',
    className = '',
    variant = 'default',
}: SynergyBoardProps) {
    const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
    const visibleSynergies = useMemo(() => synergies.filter((synergy) => synergy.visible), [synergies]);
    const isCompact = variant === 'compact';

    if (isCompact) {
        return (
            <div className={`rounded-[22px] border border-slate-700/80 bg-slate-950/90 p-2.5 shadow-2xl shadow-black/40 backdrop-blur-md ${className}`}>
                {visibleSynergies.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/70 px-3 py-3 text-[11px] text-slate-400">
                        {emptyText}
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {visibleSynergies.map((synergy) => {
                            const tone = toneClasses[synergy.statusTone];
                            const isOpen = openTooltipId === synergy.id;

                            return (
                                <div key={synergy.id} className="group relative">
                                    <button
                                        type="button"
                                        title={synergy.tooltipText}
                                        onClick={() => setOpenTooltipId((current) => (current === synergy.id ? null : synergy.id))}
                                        className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${tone.row}`}
                                    >
                                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border text-[10px] font-black tracking-wide ${tone.badge}`}>
                                            {synergy.symbol}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate text-[12px] font-semibold leading-none text-white">{synergy.label}</span>
                                                <span className={`flex-shrink-0 text-[11px] font-black ${tone.progress}`}>{synergy.progressText}</span>
                                            </div>
                                            <p className={`mt-1 truncate text-[10px] leading-none ${tone.status}`}>{synergy.statusText}</p>
                                        </div>
                                    </button>

                                    <div
                                        className={`absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-600 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl shadow-black/50 transition md:left-auto md:right-0 ${
                                            isOpen
                                                ? 'pointer-events-auto translate-y-0 opacity-100'
                                                : 'pointer-events-none translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100'
                                        }`}
                                    >
                                        {synergy.tooltipText}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`rounded-2xl border border-slate-700 bg-slate-900/70 p-3 shadow-xl shadow-slate-950/20 ${className}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Draft Readout</p>
                    <h4 className="text-sm font-bold text-white">{title}</h4>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {visibleSynergies.length} live
                </span>
            </div>

            {visibleSynergies.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-3 py-4 text-xs text-slate-400">
                    {emptyText}
                </div>
            ) : (
                <div className="space-y-2">
                    {visibleSynergies.map((synergy) => {
                        const tone = toneClasses[synergy.statusTone];
                        const isOpen = openTooltipId === synergy.id;

                        return (
                            <div key={synergy.id} className="group relative">
                                <button
                                    type="button"
                                    title={synergy.tooltipText}
                                    onClick={() => setOpenTooltipId((current) => (current === synergy.id ? null : synergy.id))}
                                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${tone.row}`}
                                >
                                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border text-[11px] font-black tracking-wide ${tone.badge}`}>
                                        {synergy.symbol}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <span className="truncate text-sm font-semibold text-white">{synergy.label}</span>
                                            <span className={`flex-shrink-0 text-xs font-black ${tone.progress}`}>{synergy.progressText}</span>
                                        </div>
                                        <p className={`mt-0.5 text-[11px] ${tone.status}`}>{synergy.statusText}</p>
                                    </div>
                                </button>

                                <div
                                    className={`absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-600 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl shadow-black/50 transition md:left-auto md:right-0 ${
                                        isOpen
                                            ? 'pointer-events-auto translate-y-0 opacity-100'
                                            : 'pointer-events-none translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100'
                                    }`}
                                >
                                    {synergy.tooltipText}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
