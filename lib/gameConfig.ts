// Central game configuration — import from here instead of defining locally in each component

export const ROLES = ['CAPTAIN', 'VICE CAPTAIN', 'TANK', 'DUELIST', 'SUPPORT'] as const;
export const ROLES_DISPLAY = ['Captain', 'Vice Captain', 'Tank', 'Duelist', 'Support'] as const;
export const ROLE_KEYS = ['captain', 'viceCaptain', 'tank', 'duelist', 'support'] as const;

export type RoleKey = typeof ROLE_KEYS[number];

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
