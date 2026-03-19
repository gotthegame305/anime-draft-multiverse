import type { RoleKey as ConfigRoleKey } from '@/lib/gameConfig';

export type RoleKey = ConfigRoleKey;
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
    verificationReason?: string;
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
    displayName?: string;
    cards: CharacterItem[];
    synergies: SynergyRow[];
    accent: 'cyan' | 'fuchsia';
}

export interface ReplayScenario {
    player: SquadDefinition;
    opponents: SquadDefinition[];
    events: ReplayEvent[];
}

export interface SquadEntry {
    role: RoleKey;
    card: CharacterItem;
}

export const ROLES: RoleKey[] = ['captain', 'viceCaptain', 'tank', 'duelist', 'support', 'traitor'];

export const HUD_METRICS = {
    cardWidth: 104,
    cardHeight: 142,
    rowGap: 16,
    squadColumnWidth: 320,
    squadPaddingX: 28,
    stageGap: 20,
    laneWidth: 188,
    logWidth: 340,
    headerHeight: 38,
} as const;
