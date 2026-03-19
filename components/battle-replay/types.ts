'use client';

export type RoleKey = 'captain' | 'viceCaptain' | 'tank' | 'duelist' | 'support' | 'traitor';
export type ReplayEventType = 'phase-start' | 'modifier' | 'round-start' | 'attack' | 'score' | 'round-end' | 'final';
export type ModifierKind = 'support' | 'aura' | 'traitor';
export type ReplayMode = 'single' | 'multiplayer';

export interface CharacterItem {
    id: number;
    name: string;
    imageUrl: string;
    animeUniverse: string;
    stars: number;
    favorites: number;
}

export interface ReplayEvent {
    type: ReplayEventType;
    role?: RoleKey;
    actorId?: number;
    targetId?: number;
    actorSquadId?: string;
    targetSquadId?: string;
    winnerSquadId?: string;
    delta?: number;
    text: string;
    duration?: number;
    modifierKind?: ModifierKind;
    starDelta?: number;
    phase?: 'pre-battle' | 'combat' | 'resolution';
}

export interface SynergyRow {
    symbol: string;
    label: string;
    progress: string;
    tone: 'cyan' | 'sky' | 'emerald' | 'teal' | 'amber' | 'yellow' | 'fuchsia';
    hint: string;
}

export interface SquadDefinition {
    id: string;
    title: string;
    cards: CharacterItem[];
    synergies: SynergyRow[];
    accent: 'cyan' | 'fuchsia';
}

export interface ReplayScenario {
    player: SquadDefinition;
    opponents: SquadDefinition[];
    events: ReplayEvent[];
}

export interface BattleReplayProps {
    scenario?: ReplayScenario;
    initialMode?: ReplayMode;
}

export interface SquadEntry {
    role: RoleKey;
    card: CharacterItem;
}

export const ROLES: RoleKey[] = ['captain', 'viceCaptain', 'tank', 'duelist', 'support', 'traitor'];

export const HUD_METRICS = {
    cardWidth: 88,
    cardHeight: 118,
    rowGap: 14,
    squadColumnWidth: 270,
    squadPaddingX: 28,
    stageGap: 18,
    laneWidth: 152,
    logWidth: 328,
    headerHeight: 34,
} as const;
