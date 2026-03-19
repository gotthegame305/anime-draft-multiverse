import type { CharacterItem, ReplayEvent, ReplayScenario, SquadDefinition, SynergyRow } from '@/components/battle-replay/types';

const playerTeam: CharacterItem[] = [
    { id: 1, name: 'Gojo', imageUrl: 'https://images.unsplash.com/photo-1542204625-de293a2f8ff0?auto=format&fit=crop&w=600&q=80', animeUniverse: 'JJK', stars: 5, favorites: 9999 },
    { id: 2, name: 'Levi', imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80', animeUniverse: 'AOT', stars: 4, favorites: 8500 },
    { id: 3, name: 'All Might', imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80', animeUniverse: 'MHA', stars: 5, favorites: 7800 },
    { id: 4, name: 'Ichigo', imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Bleach', stars: 4, favorites: 7100 },
    { id: 5, name: 'Chopper', imageUrl: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=600&q=80', animeUniverse: 'One Piece', stars: 3, favorites: 4200 },
    { id: 6, name: 'Griffith', imageUrl: 'https://images.unsplash.com/photo-1506795660198-e95c77602129?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Berserk', stars: 2, favorites: 3900 },
];

const leftSynergies: SynergyRow[] = [
    { symbol: 'U', label: 'Homeworld', progress: '2 / 3', tone: 'cyan', hint: 'largest universe group' },
    { symbol: '2x2', label: 'Twin Realms', progress: '2 + 1 / 2 + 2', tone: 'sky', hint: 'two-universe split' },
    { symbol: '5U', label: 'Multiverse Tour', progress: '4 unique / 5', tone: 'emerald', hint: 'all unique so far' },
    { symbol: 'FIT', label: 'Perfect Casting', progress: '3 / 5', tone: 'teal', hint: 'best-role placements' },
    { symbol: 'STAR', label: 'Star Sweep', progress: 'tier 5 live', tone: 'amber', hint: 'uniform stars still alive' },
    { symbol: 'PWR', label: 'Power Curve', progress: '23 stars', tone: 'yellow', hint: 'raw assigned-star total' },
];

const rightSynergies: SynergyRow[] = [
    { symbol: 'U', label: 'Homeworld', progress: '3 / 3', tone: 'cyan', hint: 'three from one universe' },
    { symbol: 'FIT', label: 'Perfect Casting', progress: '2 / 5', tone: 'teal', hint: 'best-role placements' },
    { symbol: 'PWR', label: 'Power Curve', progress: '19 stars', tone: 'yellow', hint: 'raw assigned-star total' },
];

const opponents: SquadDefinition[] = [
    {
        id: 'enemy-1',
        title: 'Enemy Squad',
        accent: 'fuchsia' as const,
        cards: [
            { id: 101, name: 'Sukuna', imageUrl: 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=600&q=80', animeUniverse: 'JJK', stars: 5, favorites: 9800 },
            { id: 102, name: 'Mikasa', imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80', animeUniverse: 'AOT', stars: 5, favorites: 9200 },
            { id: 103, name: 'Endeavor', imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80', animeUniverse: 'MHA', stars: 4, favorites: 6000 },
            { id: 104, name: 'Aizen', imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Bleach', stars: 5, favorites: 8300 },
            { id: 105, name: 'Law', imageUrl: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=600&q=80', animeUniverse: 'One Piece', stars: 4, favorites: 5000 },
            { id: 106, name: 'Reiner', imageUrl: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=600&q=80', animeUniverse: 'AOT', stars: 3, favorites: 4600 },
        ],
        synergies: rightSynergies,
    },
    {
        id: 'enemy-2',
        title: 'Enemy Squad',
        accent: 'fuchsia' as const,
        cards: [
            { id: 201, name: 'Naruto', imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Naruto', stars: 5, favorites: 9400 },
            { id: 202, name: 'Killua', imageUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=600&q=80', animeUniverse: 'HxH', stars: 4, favorites: 7700 },
            { id: 203, name: 'Broly', imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Dragon Ball', stars: 5, favorites: 8200 },
            { id: 204, name: 'Madara', imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Naruto', stars: 5, favorites: 8100 },
            { id: 205, name: 'Zenitsu', imageUrl: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Demon Slayer', stars: 3, favorites: 5400 },
            { id: 206, name: 'Shigaraki', imageUrl: 'https://images.unsplash.com/photo-1491528323818-fdd1faba62cc?auto=format&fit=crop&w=600&q=80', animeUniverse: 'MHA', stars: 4, favorites: 5800 },
        ],
        synergies: [
            { symbol: '2x2', label: 'Twin Realms', progress: '2 + 2', tone: 'sky', hint: 'two-universe split complete' },
            { symbol: 'STAR', label: 'Star Sweep', progress: 'tier 4 live', tone: 'amber', hint: 'uniform stars still alive' },
            { symbol: 'PWR', label: 'Power Curve', progress: '21 stars', tone: 'yellow', hint: 'raw assigned-star total' },
        ],
    },
    {
        id: 'enemy-3',
        title: 'Enemy Squad',
        accent: 'fuchsia' as const,
        cards: [
            { id: 301, name: 'Jotaro', imageUrl: 'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=600&q=80', animeUniverse: 'JoJo', stars: 4, favorites: 7600 },
            { id: 302, name: 'Saber', imageUrl: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Fate', stars: 5, favorites: 9300 },
            { id: 303, name: 'Escanor', imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80', animeUniverse: 'SDS', stars: 5, favorites: 6800 },
            { id: 304, name: 'Yoruichi', imageUrl: 'https://images.unsplash.com/photo-1546961329-78bef0414d7c?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Bleach', stars: 4, favorites: 7500 },
            { id: 305, name: 'Rimuru', imageUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Slime', stars: 4, favorites: 7200 },
            { id: 306, name: 'Dio', imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80', animeUniverse: 'JoJo', stars: 5, favorites: 8000 },
        ],
        synergies: [
            { symbol: 'U', label: 'Homeworld', progress: '2 / 3', tone: 'cyan', hint: 'largest universe group' },
            { symbol: '5U', label: 'Multiverse Tour', progress: '4 unique / 5', tone: 'emerald', hint: 'all unique so far' },
            { symbol: 'FIT', label: 'Perfect Casting', progress: '3 / 5', tone: 'teal', hint: 'best-role placements' },
        ],
    },
    {
        id: 'enemy-4',
        title: 'Enemy Squad',
        accent: 'fuchsia' as const,
        cards: [
            { id: 401, name: 'Luffy', imageUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=600&q=80', animeUniverse: 'One Piece', stars: 5, favorites: 9600 },
            { id: 402, name: 'Asta', imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Black Clover', stars: 4, favorites: 6100 },
            { id: 403, name: 'Bam', imageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Tower of God', stars: 4, favorites: 5900 },
            { id: 404, name: 'Yusuke', imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Yu Yu Hakusho', stars: 4, favorites: 6400 },
            { id: 405, name: 'Shinobu', imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80', animeUniverse: 'Demon Slayer', stars: 3, favorites: 5300 },
            { id: 406, name: 'Hisoka', imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80', animeUniverse: 'HxH', stars: 4, favorites: 7200 },
        ],
        synergies: [
            { symbol: 'PWR', label: 'Power Curve', progress: '20 stars', tone: 'yellow', hint: 'raw assigned-star total' },
            { symbol: 'FIT', label: 'Perfect Casting', progress: '2 / 5', tone: 'teal', hint: 'best-role placements' },
            { symbol: 'U', label: 'Homeworld', progress: '1 / 3', tone: 'cyan', hint: 'still alive' },
        ],
    },
];

const events: ReplayEvent[] = [
    { type: 'phase-start', phase: 'pre-battle', text: 'Pre-battle modifiers online', duration: 800 },
    { type: 'modifier', role: 'support', actorId: 5, targetId: 1, actorSquadId: 'player', targetSquadId: 'player', modifierKind: 'support', starDelta: 1, text: 'Chopper channels recovery tech into Gojo: +1 star', duration: 1200 },
    { type: 'modifier', role: 'support', actorId: 105, targetId: 2, actorSquadId: 'enemy-1', targetSquadId: 'player', modifierKind: 'aura', starDelta: -1, text: 'Law floods the lane with pressure: Levi loses 1 star', duration: 1200 },
    { type: 'modifier', role: 'traitor', actorId: 6, targetId: 3, actorSquadId: 'player', targetSquadId: 'player', modifierKind: 'traitor', starDelta: -1, text: 'Griffith siphons momentum from All Might: -1 star', duration: 1200 },
    { type: 'phase-start', phase: 'combat', text: 'Combat phase begins // traitor channels open', duration: 850 },
    { type: 'round-start', role: 'captain', targetSquadId: 'enemy-1', text: 'Captain lane engages', duration: 500 },
    { type: 'attack', role: 'captain', actorId: 1, targetId: 101, actorSquadId: 'player', targetSquadId: 'enemy-1', text: 'Gojo collides with Sukuna in the captain lane', duration: 1050 },
    { type: 'score', role: 'captain', winnerSquadId: 'player', delta: 1, targetSquadId: 'enemy-1', text: 'Your squad secures the captain point', duration: 750 },
    { type: 'round-end', role: 'captain', targetSquadId: 'enemy-1', text: 'Captain lane resolved', duration: 450 },
    { type: 'round-start', role: 'viceCaptain', targetSquadId: 'enemy-1', text: 'Vice Captain lane engages', duration: 500 },
    { type: 'attack', role: 'viceCaptain', actorId: 102, targetId: 2, actorSquadId: 'enemy-1', targetSquadId: 'player', text: 'Mikasa slips through Levi’s guard', duration: 1050 },
    { type: 'score', role: 'viceCaptain', winnerSquadId: 'enemy-1', delta: 1, targetSquadId: 'enemy-1', text: 'Enemy Squad scores on vice captain', duration: 750 },
    { type: 'round-end', role: 'viceCaptain', targetSquadId: 'enemy-1', text: 'Vice Captain lane resolved', duration: 450 },
    { type: 'round-start', role: 'tank', targetSquadId: 'enemy-1', text: 'Tank lane engages', duration: 500 },
    { type: 'attack', role: 'tank', actorId: 3, targetId: 103, actorSquadId: 'player', targetSquadId: 'enemy-1', text: 'All Might bursts through Endeavor’s defense wall', duration: 1050 },
    { type: 'score', role: 'tank', winnerSquadId: 'player', delta: 1, targetSquadId: 'enemy-1', text: 'Your squad takes the tank point', duration: 750 },
    { type: 'round-end', role: 'tank', targetSquadId: 'enemy-1', text: 'Tank lane resolved', duration: 450 },
    { type: 'round-start', role: 'duelist', targetSquadId: 'enemy-1', text: 'Duelist lane engages', duration: 500 },
    { type: 'attack', role: 'duelist', actorId: 104, targetId: 4, actorSquadId: 'enemy-1', targetSquadId: 'player', text: 'Aizen overwhelms Ichigo on the duelist lane', duration: 1050 },
    { type: 'score', role: 'duelist', winnerSquadId: 'enemy-1', delta: 1, targetSquadId: 'enemy-1', text: 'Enemy Squad steals the duelist point', duration: 750 },
    { type: 'round-end', role: 'duelist', targetSquadId: 'enemy-1', text: 'Duelist lane resolved', duration: 450 },
    { type: 'round-start', role: 'support', targetSquadId: 'enemy-1', text: 'Support lane engages', duration: 500 },
    { type: 'attack', role: 'support', actorId: 5, targetId: 105, actorSquadId: 'player', targetSquadId: 'enemy-1', text: 'Chopper outlasts Law in the support lane', duration: 1050 },
    { type: 'score', role: 'support', winnerSquadId: 'player', delta: 1, targetSquadId: 'enemy-1', text: 'Your squad scores on support', duration: 750 },
    { type: 'round-end', role: 'support', targetSquadId: 'enemy-1', text: 'Support lane resolved', duration: 450 },
    { type: 'round-start', role: 'traitor', targetSquadId: 'enemy-1', text: 'Traitor lane engages // defectors crossing over', duration: 800 },
    { type: 'attack', role: 'traitor', actorId: 6, targetId: 106, actorSquadId: 'enemy-1', targetSquadId: 'player', text: 'Griffith defects and clashes in the traitor lane', duration: 1200 },
    { type: 'score', role: 'traitor', winnerSquadId: 'player', delta: 1, targetSquadId: 'enemy-1', text: 'Your squad claims the traitor swing', duration: 850 },
    { type: 'round-end', role: 'traitor', targetSquadId: 'enemy-1', text: 'Traitor lane resolved', duration: 450 },
    { type: 'final', phase: 'resolution', winnerSquadId: 'player', text: 'Final broadcast: Your squad wins 4 - 2.', duration: 1200 },
];

export const mockReplayScenario: ReplayScenario = {
    player: {
        id: 'player',
        title: 'Your Squad',
        accent: 'cyan',
        cards: playerTeam,
        synergies: leftSynergies,
    },
    opponents,
    events,
};

export function createBaseStarMap(scenario: ReplayScenario) {
    return [scenario.player, ...scenario.opponents]
        .flatMap((squad) => squad.cards)
        .reduce<Record<number, number>>((acc, card) => {
            acc[card.id] = card.stars;
            return acc;
        }, {});
}
