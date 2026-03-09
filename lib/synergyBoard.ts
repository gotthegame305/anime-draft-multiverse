import type { CharacterItem } from '@/app/actions';
import { BASE_ROLES, SCORING_CONFIG, type RoleKey } from '@/lib/gameConfig';

export type SynergyId =
    | 'homeworld'
    | 'twin-realms'
    | 'multiverse-tour'
    | 'perfect-casting'
    | 'star-sweep'
    | 'power-curve';

export type SynergyStatusTone = 'partial' | 'completed';

export interface SynergyDefinition {
    id: SynergyId;
    label: string;
    symbol: string;
}

export interface SynergyProgress extends SynergyDefinition {
    visible: boolean;
    completed: boolean;
    progressText: string;
    statusText: string;
    tooltipText: string;
    statusTone: SynergyStatusTone;
}

interface BaseEntry {
    role: typeof BASE_ROLES[number];
    char: CharacterItem | null;
    rawStars: number;
}

const SYNERGY_DEFINITIONS: Record<SynergyId, SynergyDefinition> = {
    homeworld: { id: 'homeworld', label: 'Homeworld', symbol: 'U' },
    'twin-realms': { id: 'twin-realms', label: 'Twin Realms', symbol: '2x2' },
    'multiverse-tour': { id: 'multiverse-tour', label: 'Multiverse Tour', symbol: '5U' },
    'perfect-casting': { id: 'perfect-casting', label: 'Perfect Casting', symbol: 'FIT' },
    'star-sweep': { id: 'star-sweep', label: 'Star Sweep', symbol: 'STAR' },
    'power-curve': { id: 'power-curve', label: 'Power Curve', symbol: 'PWR' },
};

function getBaseEntries(team: (CharacterItem | null)[], roles: RoleKey[]): BaseEntry[] {
    return BASE_ROLES.map((role) => {
        const roleIndex = roles.indexOf(role);
        const char = roleIndex === -1 ? null : (team[roleIndex] ?? null);
        const rawStars = char ? Number(char.stats?.roleStats?.[role] || 1) : 0;

        return { role, char, rawStars };
    });
}

function createHiddenProgress(id: SynergyId): SynergyProgress {
    return {
        ...SYNERGY_DEFINITIONS[id],
        visible: false,
        completed: false,
        progressText: '',
        statusText: '',
        tooltipText: '',
        statusTone: 'partial',
    };
}

function createProgress(
    id: SynergyId,
    values: Omit<SynergyProgress, keyof SynergyDefinition | 'id'>
): SynergyProgress {
    return {
        ...SYNERGY_DEFINITIONS[id],
        ...values,
    };
}

function getPluralizedCards(count: number) {
    return `${count} more card${count === 1 ? '' : 's'}`;
}

export function evaluateSynergyBoard(team: (CharacterItem | null)[], roles: RoleKey[]): SynergyProgress[] {
    const baseEntries = getBaseEntries(team, roles);
    const placedEntries = baseEntries.filter((entry) => entry.char !== null);
    const placedCount = placedEntries.length;
    const slotsRemaining = BASE_ROLES.length - placedCount;
    const rawStars = placedEntries.map((entry) => entry.rawStars);
    const rawStarTotal = rawStars.reduce((sum, stars) => sum + stars, 0);
    const fitCount = placedEntries.reduce((total, entry) => {
        if (!entry.char) return total;

        const bestRoleStars = BASE_ROLES.reduce((best, role) => {
            return Math.max(best, Number(entry.char?.stats?.roleStats?.[role] || 0));
        }, 0);

        return entry.rawStars === bestRoleStars ? total + 1 : total;
    }, 0);

    const universeEntries = new Map<string, number>();
    for (const entry of placedEntries) {
        const universe = entry.char?.animeUniverse;
        if (!universe) continue;
        universeEntries.set(universe, (universeEntries.get(universe) || 0) + 1);
    }

    const sortedUniverseEntries = Array.from(universeEntries.entries()).sort((left, right) => right[1] - left[1]);
    const universeCounts = sortedUniverseEntries.map((entry) => entry[1]);
    const largestUniverseEntry = sortedUniverseEntries[0];
    const largestCount = largestUniverseEntry?.[1] || 0;
    const largestUniverseName = largestUniverseEntry?.[0] || 'this universe';
    const uniqueCount = universeEntries.size;
    const hasDuplicateUniverse = universeCounts.some((count) => count > 1);

    const sameUniversePoints = SCORING_CONFIG.sameUniverseBonuses;
    const bestRoleBasePoints = SCORING_CONFIG.bestRoleMatchPoint;
    const sharedStar = rawStars[0] || 0;
    const uniformStars = rawStars.length > 0 && rawStars.every((stars) => stars === sharedStar);
    const starSweepPoints = SCORING_CONFIG.starSweepBonuses as Record<number, number>;

    const homeworldVisible = largestCount > 0 && (largestCount >= 3 || largestCount + slotsRemaining >= 3);
    const homeworldCompleted = largestCount >= 3;
    const homeworldProgressTarget = largestCount >= 4 ? 5 : 3;
    const homeworldProgressText = `${largestCount} / ${homeworldProgressTarget}`;
    let homeworldStatusText = '';
    let homeworldTooltipText = '';

    if (homeworldVisible) {
        if (largestCount >= 5) {
            homeworldStatusText = `+${sameUniversePoints[3] + sameUniversePoints[4] + sameUniversePoints[5]} live`;
            homeworldTooltipText = `Five cards from ${largestUniverseName} are locked in. Homeworld pays +${sameUniversePoints[3]} at 3, +${sameUniversePoints[4]} at 4, and +${sameUniversePoints[5]} at 5 for +${sameUniversePoints[3] + sameUniversePoints[4] + sameUniversePoints[5]} total.`;
        } else if (largestCount === 4) {
            homeworldStatusText = `+${sameUniversePoints[3] + sameUniversePoints[4]} live`;
            homeworldTooltipText = `Four cards from ${largestUniverseName} are active. You already have +${sameUniversePoints[3] + sameUniversePoints[4]}, and one more card from ${largestUniverseName} reaches the full 5-card Homeworld stack.`;
        } else if (largestCount === 3) {
            homeworldStatusText = `+${sameUniversePoints[3]} live`;
            homeworldTooltipText = `Three cards from ${largestUniverseName} have started the Homeworld line for +${sameUniversePoints[3]}. More copies can still push it to 4 same (+${sameUniversePoints[4]}) and 5 same (+${sameUniversePoints[5]}).`;
        } else {
            const needed = 3 - largestCount;
            homeworldStatusText = `Need ${needed}`;
            homeworldTooltipText = `You need ${getPluralizedCards(needed)} from ${largestUniverseName} to begin the Homeworld bonus at 3 same (+${sameUniversePoints[3]}).`;
        }
    }

    const twinRealmVisibleBase = universeCounts.length >= 2;
    const currentPairCounts = universeCounts.slice(0, 2);
    while (currentPairCounts.length < 2) currentPairCounts.push(0);
    const pairCandidates = [...universeCounts, 0, 0];
    let pairCardsNeeded = Number.POSITIVE_INFINITY;

    for (let left = 0; left < pairCandidates.length; left += 1) {
        for (let right = left + 1; right < pairCandidates.length; right += 1) {
            const needed = Math.max(0, 2 - pairCandidates[left]) + Math.max(0, 2 - pairCandidates[right]);
            if (needed < pairCardsNeeded) {
                pairCardsNeeded = needed;
            }
        }
    }

    const twinRealmsCompleted = universeCounts.filter((count) => count >= 2).length >= 2;
    const twinRealmsVisible = twinRealmVisibleBase && (twinRealmsCompleted || pairCardsNeeded <= slotsRemaining);
    const twinRealmsProgressText = `${Math.min(currentPairCounts[0], 2)}+${Math.min(currentPairCounts[1], 2)} / 2+2`;
    const twinRealmsStatusText = twinRealmsCompleted ? `+${SCORING_CONFIG.twoUniversePairBonus} live` : `Need ${pairCardsNeeded}`;
    const twinRealmsTooltipText = twinRealmsCompleted
        ? `Two different universes already have pairs. Twin Realms is active for +${SCORING_CONFIG.twoUniversePairBonus}.`
        : `Get at least 2 cards from one universe and 2 from another different universe. You need ${pairCardsNeeded} more matching picks to finish Twin Realms for +${SCORING_CONFIG.twoUniversePairBonus}.`;

    const multiverseTourVisible = placedCount > 0 && !hasDuplicateUniverse;
    const multiverseTourCompleted = uniqueCount === BASE_ROLES.length;
    const multiverseTourTooltipText = multiverseTourCompleted
        ? `All five base-role cards come from different universes. Multiverse Tour is active for +${SCORING_CONFIG.allDifferentUniverseBonus}.`
        : `Keep every placed base-role card from a different universe. You need ${BASE_ROLES.length - uniqueCount} more unique universe${BASE_ROLES.length - uniqueCount === 1 ? '' : 's'} to finish Multiverse Tour for +${SCORING_CONFIG.allDifferentUniverseBonus}.`;

    const perfectCastingVisible = fitCount > 0;
    const perfectCastingCompleted = fitCount === BASE_ROLES.length;
    const perfectCastingPoints = perfectCastingCompleted
        ? SCORING_CONFIG.allBestRoleTotal
        : fitCount * bestRoleBasePoints;
    const perfectCastingTooltipText = perfectCastingCompleted
        ? `All five placed base-role cards are in one of their tied-best roles. Perfect Casting upgrades to +${SCORING_CONFIG.allBestRoleTotal} total points.`
        : `${fitCount} placed card${fitCount === 1 ? '' : 's'} already match a tied-best base role. Each match is worth +${bestRoleBasePoints}, and all five together upgrade to +${SCORING_CONFIG.allBestRoleTotal} total.`;

    const starSweepVisible = placedCount > 0 && uniformStars;
    const starSweepCompleted = starSweepVisible && placedCount === BASE_ROLES.length;
    const starSweepBonus = starSweepPoints[sharedStar] || 0;
    const starSweepTooltipText = starSweepCompleted
        ? `All five base-role cards share ${sharedStar}-star raw assigned values. Star Sweep is active for +${starSweepBonus}.`
        : `Every placed base-role card is ${sharedStar}-star right now. Keep the remaining ${slotsRemaining} slot${slotsRemaining === 1 ? '' : 's'} at ${sharedStar}-star to finish Star Sweep for +${starSweepBonus}.`;

    const powerCurveVisible = placedCount > 0;
    const powerCurveCompleted = placedCount === BASE_ROLES.length;
    const powerCurveTooltipText = `Power Curve tracks your raw assigned stars across the base 5 roles. Right now it is worth +${rawStarTotal} points.`;

    return [
        homeworldVisible
            ? createProgress('homeworld', {
                visible: true,
                completed: homeworldCompleted,
                progressText: homeworldProgressText,
                statusText: homeworldStatusText,
                tooltipText: homeworldTooltipText,
                statusTone: homeworldCompleted ? 'completed' : 'partial',
            })
            : createHiddenProgress('homeworld'),
        twinRealmsVisible
            ? createProgress('twin-realms', {
                visible: true,
                completed: twinRealmsCompleted,
                progressText: twinRealmsProgressText,
                statusText: twinRealmsStatusText,
                tooltipText: twinRealmsTooltipText,
                statusTone: twinRealmsCompleted ? 'completed' : 'partial',
            })
            : createHiddenProgress('twin-realms'),
        multiverseTourVisible
            ? createProgress('multiverse-tour', {
                visible: true,
                completed: multiverseTourCompleted,
                progressText: `${uniqueCount} / ${BASE_ROLES.length}`,
                statusText: multiverseTourCompleted ? `+${SCORING_CONFIG.allDifferentUniverseBonus} live` : `${BASE_ROLES.length - uniqueCount} left`,
                tooltipText: multiverseTourTooltipText,
                statusTone: multiverseTourCompleted ? 'completed' : 'partial',
            })
            : createHiddenProgress('multiverse-tour'),
        perfectCastingVisible
            ? createProgress('perfect-casting', {
                visible: true,
                completed: perfectCastingCompleted,
                progressText: `${fitCount} / ${BASE_ROLES.length}`,
                statusText: perfectCastingCompleted ? `+${SCORING_CONFIG.allBestRoleTotal} live` : `+${perfectCastingPoints} live`,
                tooltipText: perfectCastingTooltipText,
                statusTone: perfectCastingCompleted ? 'completed' : 'partial',
            })
            : createHiddenProgress('perfect-casting'),
        starSweepVisible
            ? createProgress('star-sweep', {
                visible: true,
                completed: starSweepCompleted,
                progressText: `${placedCount} / ${BASE_ROLES.length}`,
                statusText: starSweepCompleted ? `+${starSweepBonus} live` : `${sharedStar}* line`,
                tooltipText: starSweepTooltipText,
                statusTone: starSweepCompleted ? 'completed' : 'partial',
            })
            : createHiddenProgress('star-sweep'),
        powerCurveVisible
            ? createProgress('power-curve', {
                visible: true,
                completed: powerCurveCompleted,
                progressText: `${rawStarTotal} stars`,
                statusText: `+${rawStarTotal} points`,
                tooltipText: powerCurveTooltipText,
                statusTone: powerCurveCompleted ? 'completed' : 'partial',
            })
            : createHiddenProgress('power-curve'),
    ];
}
