// Central game configuration — import from here instead of defining locally in each component

export const BASE_ROLES = ['captain', 'viceCaptain', 'tank', 'duelist', 'support'] as const;
export const MODIFIER_ROLES = ['aura', 'traitor'] as const;
export const ROLE_KEYS = [...BASE_ROLES, ...MODIFIER_ROLES] as const;

export type RoleKey = typeof ROLE_KEYS[number];

export const ROLE_DISPLAY_NAMES: Record<RoleKey, string> = {
    captain: 'Captain',
    viceCaptain: 'Vice Captain',
    tank: 'Tank',
    duelist: 'Duelist',
    support: 'Support',
    aura: 'Aura',
    traitor: 'Traitor'
};

export const GAME_CONFIG = {
    /** Number of skips/redraws each player starts with */
    initialSkips: 2,
    /** Minimum characters in pool before a draft can start */
    minPoolSize: 10,
    /** How long a player has to take their turn before it auto-passes (ms) */
    turnTimeoutMs: 30_000,
    /** Impact sound played on each draw */
    impactSoundUrl: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
} as const;
