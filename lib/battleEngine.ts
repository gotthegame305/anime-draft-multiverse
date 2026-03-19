import type { CharacterItem } from '@/app/actions';
import { BASE_ROLES, SCORING_CONFIG, type RoleKey as ConfigRoleKey } from '@/lib/gameConfig';
import type { ModifierKind, ReplayEvent } from '@/lib/replayTypes';

export type RoleKey = ConfigRoleKey;
type BaseRoleKey = typeof BASE_ROLES[number];

export interface ScoreBreakdown {
    combatPoints: number;
    rawStarPoints: number;
    universeBonusPoints: number;
    bestRolePoints: number;
    starSweepPoints: number;
    totalPoints: number;
}

export interface BattleResult {
    isWin: boolean;
    userScore: number;
    cpuScore: number;
    logs: string[];
    userBreakdown: ScoreBreakdown;
    cpuBreakdown: ScoreBreakdown;
    replayEvents: ReplayEvent[];
}

export interface MultiplayerBattleResult {
    winnerId: string;
    scores: { [userId: string]: number };
    logs: string[];
    breakdowns: { [userId: string]: ScoreBreakdown };
}

interface WinnerResolution {
    winnerId: string;
    reason: 'total' | 'raw-stars' | 'player-order';
    tiedOnTotal: string[];
    tiedOnRawStars: string[];
}

interface BaseRoleEntry {
    role: BaseRoleKey;
    char: CharacterItem | null;
    rawStars: number;
}

export function calculateCharacterPower(char: CharacterItem, role: RoleKey, effectiveStars: number): number {
    const favorites = char.stats?.favorites || 100;
    const base = Math.log(favorites);
    return (effectiveStars * 20) + base;
}

function getRoleStars(char: CharacterItem | null, role: RoleKey): number {
    if (!char) return 0;
    return Number(char.stats?.roleStats?.[role] || 1);
}

function getReplayRoleLabel(role: RoleKey) {
    switch (role) {
        case 'captain':
            return 'Captain';
        case 'viceCaptain':
            return 'Vice Captain';
        case 'tank':
            return 'Tank';
        case 'duelist':
            return 'Duelist';
        case 'support':
            return 'Support';
        case 'aura':
            return 'Aura';
        case 'traitor':
            return 'Traitor';
    }
}

function getModifierTarget(
    team: (CharacterItem | null)[],
    effectiveStars: number[],
    type: 'random' | 'lowest' | 'highest',
    excludeIndex: number
): number {
    let targetIndex = -1;
    let targetVal = type === 'lowest' ? Infinity : -Infinity;

    const validIndices = team
        .map((char, index) => (char !== null && index !== excludeIndex ? index : -1))
        .filter((index) => index !== -1);

    if (validIndices.length === 0) return -1;

    if (type === 'random') {
        return validIndices[Math.floor(Math.random() * validIndices.length)];
    }

    for (const index of validIndices) {
        const stars = effectiveStars[index];
        if (type === 'lowest' && stars < targetVal) {
            targetVal = stars;
            targetIndex = index;
        }
        if (type === 'highest' && stars > targetVal) {
            targetVal = stars;
            targetIndex = index;
        }
    }

    return targetIndex !== -1 ? targetIndex : validIndices[0];
}

function applyPreBattleModifier(
    sourceTeam: (CharacterItem | null)[],
    targetTeam: (CharacterItem | null)[],
    sourceEffectiveStars: number[],
    targetEffectiveStars: number[],
    modifierRole: RoleKey,
    modifierIndex: number,
    isBuff: boolean,
    teamName: string,
    targetTeamName: string,
    logs: string[],
    replayEvents?: ReplayEvent[],
    sourceSquadId?: string,
    targetSquadId?: string
) {
    const modifierChar = sourceTeam[modifierIndex];
    if (!modifierChar) return;

    const modifierStars = sourceEffectiveStars[modifierIndex];
    const change = isBuff ? 1 : -1;
    const actionText = isBuff ? 'buffs' : 'sabotages';
    const replayText = isBuff ? 'empowers' : modifierRole === 'aura' ? 'pressures' : 'sabotages';

    logs.push(`* ${teamName}'s ${modifierRole.toUpperCase()} (${modifierChar.name}) activates! (${modifierStars}*)`);

    if (modifierStars <= 2) {
        const targetIdx = getModifierTarget(targetTeam, targetEffectiveStars, 'random', isBuff ? modifierIndex : -1);
        if (targetIdx !== -1) {
            targetEffectiveStars[targetIdx] = Math.max(1, targetEffectiveStars[targetIdx] + change);
            logs.push(`  -> ${actionText} ${targetTeamName}'s random slot by 1 star.`);
            const targetChar = targetTeam[targetIdx];
            if (replayEvents && sourceSquadId && targetSquadId && targetChar) {
                replayEvents.push({
                    type: 'modifier',
                    phase: 'pre-battle',
                    role: modifierRole,
                    actorId: modifierChar.id,
                    targetId: targetChar.id,
                    actorSquadId: sourceSquadId,
                    targetSquadId,
                    modifierKind: modifierRole as ModifierKind,
                    starDelta: change,
                    text: `${modifierChar.name} ${replayText} ${targetChar.name}: ${change > 0 ? '+1 star' : '-1 star'}`,
                    duration: 900,
                });
            }
        }
    } else if (modifierStars === 3) {
        const targetIdx = getModifierTarget(targetTeam, targetEffectiveStars, 'lowest', isBuff ? modifierIndex : -1);
        if (targetIdx !== -1) {
            targetEffectiveStars[targetIdx] = Math.max(1, targetEffectiveStars[targetIdx] + change);
            logs.push(`  -> ${actionText} ${targetTeamName}'s lowest-star slot by 1 star.`);
            const targetChar = targetTeam[targetIdx];
            if (replayEvents && sourceSquadId && targetSquadId && targetChar) {
                replayEvents.push({
                    type: 'modifier',
                    phase: 'pre-battle',
                    role: modifierRole,
                    actorId: modifierChar.id,
                    targetId: targetChar.id,
                    actorSquadId: sourceSquadId,
                    targetSquadId,
                    modifierKind: modifierRole as ModifierKind,
                    starDelta: change,
                    text: `${modifierChar.name} ${replayText} ${targetChar.name}: ${change > 0 ? '+1 star' : '-1 star'}`,
                    duration: 900,
                });
            }
        }
    } else if (modifierStars === 4) {
        const targetIdx = getModifierTarget(targetTeam, targetEffectiveStars, 'highest', isBuff ? modifierIndex : -1);
        if (targetIdx !== -1) {
            targetEffectiveStars[targetIdx] = Math.max(1, targetEffectiveStars[targetIdx] + change);
            logs.push(`  -> ${actionText} ${targetTeamName}'s highest-star slot by 1 star.`);
            const targetChar = targetTeam[targetIdx];
            if (replayEvents && sourceSquadId && targetSquadId && targetChar) {
                replayEvents.push({
                    type: 'modifier',
                    phase: 'pre-battle',
                    role: modifierRole,
                    actorId: modifierChar.id,
                    targetId: targetChar.id,
                    actorSquadId: sourceSquadId,
                    targetSquadId,
                    modifierKind: modifierRole as ModifierKind,
                    starDelta: change,
                    text: `${modifierChar.name} ${replayText} ${targetChar.name}: ${change > 0 ? '+1 star' : '-1 star'}`,
                    duration: 900,
                });
            }
        }
    } else if (modifierStars >= 5) {
        for (let index = 0; index < targetTeam.length; index++) {
            const targetChar = targetTeam[index];
            if (targetChar) {
                targetEffectiveStars[index] = Math.max(1, targetEffectiveStars[index] + change);
                if (replayEvents && sourceSquadId && targetSquadId) {
                    replayEvents.push({
                        type: 'modifier',
                        phase: 'pre-battle',
                        role: modifierRole,
                        actorId: modifierChar.id,
                        targetId: targetChar.id,
                        actorSquadId: sourceSquadId,
                        targetSquadId,
                        modifierKind: modifierRole as ModifierKind,
                        starDelta: change,
                        text: `${modifierChar.name} ${replayText} ${targetChar.name}: ${change > 0 ? '+1 star' : '-1 star'}`,
                        duration: 900,
                    });
                }
            }
        }
        logs.push(`  -> ${actionText} all of ${targetTeamName}'s characters by 1 star.`);
    }
}

function getBaseRoleEntries(team: (CharacterItem | null)[], roles: RoleKey[]): BaseRoleEntry[] {
    return BASE_ROLES.map((role) => {
        const roleIndex = roles.indexOf(role);
        const char = roleIndex === -1 ? null : (team[roleIndex] ?? null);

        return {
            role,
            char,
            rawStars: getRoleStars(char, role),
        };
    });
}

function calculateScoreBreakdown(
    team: (CharacterItem | null)[],
    roles: RoleKey[],
    combatPoints: number
): ScoreBreakdown {
    const baseEntries = getBaseRoleEntries(team, roles);
    const rawStars = baseEntries.map((entry) => entry.rawStars);
    const chars = baseEntries.map((entry) => entry.char).filter((char): char is CharacterItem => char !== null);

    const universeCounts = new Map<string, number>();
    for (const char of chars) {
        universeCounts.set(char.animeUniverse, (universeCounts.get(char.animeUniverse) || 0) + 1);
    }

    let sameUniversePoints = 0;
    for (const count of Array.from(universeCounts.values())) {
        if (count >= 3) sameUniversePoints += SCORING_CONFIG.sameUniverseBonuses[3];
        if (count >= 4) sameUniversePoints += SCORING_CONFIG.sameUniverseBonuses[4];
        if (count >= 5) sameUniversePoints += SCORING_CONFIG.sameUniverseBonuses[5];
    }

    const universesWithPairs = Array.from(universeCounts.values()).filter((count) => count >= 2).length;
    const twoUniversePairPoints = universesWithPairs >= 2 ? SCORING_CONFIG.twoUniversePairBonus : 0;
    const allDifferentUniversePoints =
        chars.length === BASE_ROLES.length && universeCounts.size === BASE_ROLES.length
            ? SCORING_CONFIG.allDifferentUniverseBonus
            : 0;

    const bestRoleMatches = baseEntries.reduce((count, entry) => {
        if (!entry.char) return count;

        const bestBaseRoleStars = BASE_ROLES.reduce((best, role) => {
            return Math.max(best, getRoleStars(entry.char, role));
        }, 0);

        return entry.rawStars === bestBaseRoleStars ? count + 1 : count;
    }, 0);

    const bestRolePoints =
        bestRoleMatches === BASE_ROLES.length
            ? SCORING_CONFIG.allBestRoleTotal
            : bestRoleMatches * SCORING_CONFIG.bestRoleMatchPoint;

    let starSweepPoints = 0;
    if (rawStars.length === BASE_ROLES.length && rawStars.every((stars) => stars > 0 && stars === rawStars[0])) {
        starSweepPoints = SCORING_CONFIG.starSweepBonuses[rawStars[0] as keyof typeof SCORING_CONFIG.starSweepBonuses] || 0;
    }

    const rawStarPoints = rawStars.reduce((sum, stars) => sum + stars, 0);
    const universeBonusPoints = sameUniversePoints + twoUniversePairPoints + allDifferentUniversePoints;
    const totalPoints = combatPoints + rawStarPoints + universeBonusPoints + bestRolePoints + starSweepPoints;

    return {
        combatPoints,
        rawStarPoints,
        universeBonusPoints,
        bestRolePoints,
        starSweepPoints,
        totalPoints,
    };
}

function appendBonusScoringLogs(
    logs: string[],
    playerIds: string[],
    teamNames: { [id: string]: string },
    breakdowns: { [id: string]: ScoreBreakdown }
) {
    logs.push('\n--- BONUS SCORING ---');
    for (const playerId of playerIds) {
        const breakdown = breakdowns[playerId];
        const teamName = teamNames[playerId] || playerId;
        logs.push(
            `${teamName}: combat ${breakdown.combatPoints} + stars ${breakdown.rawStarPoints} + universe ${breakdown.universeBonusPoints} + fit ${breakdown.bestRolePoints} + sweep ${breakdown.starSweepPoints} = ${breakdown.totalPoints}`
        );
    }
}

function resolveWinner(playerIds: string[], breakdowns: { [id: string]: ScoreBreakdown }): WinnerResolution {
    const topTotal = Math.max(...playerIds.map((playerId) => breakdowns[playerId]?.totalPoints ?? 0));
    const tiedOnTotal = playerIds.filter((playerId) => (breakdowns[playerId]?.totalPoints ?? 0) === topTotal);

    if (tiedOnTotal.length === 1) {
        return {
            winnerId: tiedOnTotal[0],
            reason: 'total',
            tiedOnTotal,
            tiedOnRawStars: tiedOnTotal,
        };
    }

    const topRawStars = Math.max(...tiedOnTotal.map((playerId) => breakdowns[playerId]?.rawStarPoints ?? 0));
    const tiedOnRawStars = tiedOnTotal.filter((playerId) => (breakdowns[playerId]?.rawStarPoints ?? 0) === topRawStars);

    if (tiedOnRawStars.length === 1) {
        return {
            winnerId: tiedOnRawStars[0],
            reason: 'raw-stars',
            tiedOnTotal,
            tiedOnRawStars,
        };
    }

    return {
        winnerId: tiedOnRawStars[0],
        reason: 'player-order',
        tiedOnTotal,
        tiedOnRawStars,
    };
}

function sortPlayersForScoreboard(playerIds: string[], breakdowns: { [id: string]: ScoreBreakdown }): string[] {
    const playerOrder = new Map(playerIds.map((playerId, index) => [playerId, index]));

    return [...playerIds].sort((left, right) => {
        const leftBreakdown = breakdowns[left];
        const rightBreakdown = breakdowns[right];

        if (rightBreakdown.totalPoints !== leftBreakdown.totalPoints) {
            return rightBreakdown.totalPoints - leftBreakdown.totalPoints;
        }

        if (rightBreakdown.rawStarPoints !== leftBreakdown.rawStarPoints) {
            return rightBreakdown.rawStarPoints - leftBreakdown.rawStarPoints;
        }

        return (playerOrder.get(left) || 0) - (playerOrder.get(right) || 0);
    });
}

function buildTiebreakLog(
    resolution: WinnerResolution,
    teamNames: { [id: string]: string },
    breakdowns: { [id: string]: ScoreBreakdown }
): string | null {
    if (resolution.reason === 'total') return null;

    const winnerName = teamNames[resolution.winnerId] || resolution.winnerId;

    if (resolution.reason === 'raw-stars') {
        const details = resolution.tiedOnTotal
            .map((playerId) => `${teamNames[playerId] || playerId} ${breakdowns[playerId].rawStarPoints}`)
            .join(' | ');

        return `TIEBREAKER: ${winnerName} takes the win on higher raw star total (${details}).`;
    }

    return `TIEBREAKER: ${winnerName} takes the win on player-order tiebreak.`;
}

export function finalizeMultiplayerScores(
    teams: { [userId: string]: (CharacterItem | null)[] },
    roles: RoleKey[],
    teamNames: { [userId: string]: string },
    combatScores: { [userId: string]: number },
    baseLogs: string[] = []
): MultiplayerBattleResult {
    const playerIds = Object.keys(teams);
    const logs = [...baseLogs];
    const breakdowns = Object.fromEntries(
        playerIds.map((playerId) => [playerId, calculateScoreBreakdown(teams[playerId], roles, combatScores[playerId] ?? 0)])
    ) as { [userId: string]: ScoreBreakdown };

    appendBonusScoringLogs(logs, playerIds, teamNames, breakdowns);

    const scores = Object.fromEntries(
        playerIds.map((playerId) => [playerId, breakdowns[playerId].totalPoints])
    ) as { [userId: string]: number };

    const resolution = resolveWinner(playerIds, breakdowns);
    const sortedPlayers = sortPlayersForScoreboard(playerIds, breakdowns);
    const tiebreakLog = buildTiebreakLog(resolution, teamNames, breakdowns);

    logs.push(
        `\nTOTAL SCORE: ${sortedPlayers.map((playerId) => `${teamNames[playerId] || playerId} ${scores[playerId]}`).join(' | ')}`
    );
    if (tiebreakLog) {
        logs.push(tiebreakLog);
    }

    return {
        winnerId: resolution.winnerId,
        scores,
        logs,
        breakdowns,
    };
}

export function simulateMatchup(
    userTeam: (CharacterItem | null)[],
    cpuTeam: (CharacterItem | null)[],
    roles: RoleKey[],
    userTeamName: string = 'You',
    cpuTeamName: string = 'CPU'
): BattleResult {
    let userCombatPoints = 0;
    let cpuCombatPoints = 0;
    const logs: string[] = [];
    const replayEvents: ReplayEvent[] = [];

    const userEffectiveStars = userTeam.map((char, index) => (char ? getRoleStars(char, roles[index]) : 0));
    const cpuEffectiveStars = cpuTeam.map((char, index) => (char ? getRoleStars(char, roles[index]) : 0));

    const supportIndex = roles.indexOf('support');
    const auraIndex = roles.indexOf('aura');
    const traitorIndex = roles.indexOf('traitor');

    logs.push('\n--- PRE-BATTLE MODIFIERS ---');
    replayEvents.push({
        type: 'phase-start',
        phase: 'pre-battle',
        text: 'Pre-battle modifiers begin',
        duration: 850,
    });

    if (supportIndex !== -1) {
        applyPreBattleModifier(userTeam, userTeam, userEffectiveStars, userEffectiveStars, 'support', supportIndex, true, userTeamName, userTeamName, logs, replayEvents, 'player', 'player');
        applyPreBattleModifier(cpuTeam, cpuTeam, cpuEffectiveStars, cpuEffectiveStars, 'support', supportIndex, true, cpuTeamName, cpuTeamName, logs, replayEvents, 'enemy', 'enemy');
    }

    if (auraIndex !== -1) {
        applyPreBattleModifier(userTeam, cpuTeam, userEffectiveStars, cpuEffectiveStars, 'aura', auraIndex, false, userTeamName, cpuTeamName, logs, replayEvents, 'player', 'enemy');
        applyPreBattleModifier(cpuTeam, userTeam, cpuEffectiveStars, userEffectiveStars, 'aura', auraIndex, false, cpuTeamName, userTeamName, logs, replayEvents, 'enemy', 'player');
    }

    if (traitorIndex !== -1) {
        applyPreBattleModifier(userTeam, userTeam, userEffectiveStars, userEffectiveStars, 'traitor', traitorIndex, false, userTeamName, userTeamName, logs, replayEvents, 'player', 'player');
        applyPreBattleModifier(cpuTeam, cpuTeam, cpuEffectiveStars, cpuEffectiveStars, 'traitor', traitorIndex, false, cpuTeamName, cpuTeamName, logs, replayEvents, 'enemy', 'enemy');
    }

    logs.push('\n--- COMBAT PHASE ---');
    replayEvents.push({
        type: 'phase-start',
        phase: 'combat',
        text: 'Combat phase begins',
        duration: 850,
    });

    for (let index = 0; index < roles.length; index++) {
        const role = roles[index];
        const roleDisplayName = role.toUpperCase();
        const replayRoleLabel = getReplayRoleLabel(role);
        const userChar = userTeam[index];
        const cpuChar = cpuTeam[index];

        if (!userChar || !cpuChar) {
            logs.push(`${roleDisplayName}: ROUND DREW (Missing character)`);
            replayEvents.push({
                type: 'round-start',
                phase: 'combat',
                role,
                targetSquadId: 'enemy',
                text: `${replayRoleLabel} lane engages`,
                duration: 500,
            });
            replayEvents.push({
                type: 'round-end',
                phase: 'combat',
                role,
                targetSquadId: 'enemy',
                text: `${replayRoleLabel} lane resolves with no combatants`,
                duration: 450,
            });
            continue;
        }

        const userStars = userEffectiveStars[index];
        const cpuStars = cpuEffectiveStars[index];
        const userPower = calculateCharacterPower(userChar, role, userStars);
        const cpuPower = calculateCharacterPower(cpuChar, role, cpuStars);
        const isTraitorRound = role === 'traitor';

        replayEvents.push({
            type: 'round-start',
            phase: 'combat',
            role,
            targetSquadId: 'enemy',
            text: `${replayRoleLabel} lane engages`,
            duration: 500,
        });

        if (userPower > cpuPower) {
            replayEvents.push({
                type: 'attack',
                phase: 'combat',
                role,
                actorId: userChar.id,
                targetId: cpuChar.id,
                actorSquadId: 'player',
                targetSquadId: 'enemy',
                text: `${userChar.name} crashes into ${cpuChar.name} on the ${replayRoleLabel.toLowerCase()} lane`,
                duration: 1050,
            });
            if (isTraitorRound) {
                cpuCombatPoints += 1;
                logs.push(`${roleDisplayName} (Traitor Penalty): ${userChar.name} gives a point to ${cpuTeamName}.`);
                replayEvents.push({
                    type: 'score',
                    phase: 'combat',
                    role,
                    winnerSquadId: 'enemy',
                    delta: 1,
                    targetSquadId: 'enemy',
                    text: `${cpuTeamName} claims the traitor swing`,
                    duration: 750,
                });
            } else {
                userCombatPoints += 1;
                logs.push(`${roleDisplayName}: ${userChar.name} defeats ${cpuChar.name}.`);
                replayEvents.push({
                    type: 'score',
                    phase: 'combat',
                    role,
                    winnerSquadId: 'player',
                    delta: 1,
                    targetSquadId: 'enemy',
                    text: `${userTeamName} secures the ${replayRoleLabel.toLowerCase()} point`,
                    duration: 750,
                });
            }
        } else if (cpuPower > userPower) {
            replayEvents.push({
                type: 'attack',
                phase: 'combat',
                role,
                actorId: cpuChar.id,
                targetId: userChar.id,
                actorSquadId: 'enemy',
                targetSquadId: 'player',
                text: `${cpuChar.name} overwhelms ${userChar.name} on the ${replayRoleLabel.toLowerCase()} lane`,
                duration: 1050,
            });
            if (isTraitorRound) {
                userCombatPoints += 1;
                logs.push(`${roleDisplayName} (Traitor Penalty): ${cpuTeamName}'s ${cpuChar.name} gives a point to ${userTeamName}.`);
                replayEvents.push({
                    type: 'score',
                    phase: 'combat',
                    role,
                    winnerSquadId: 'player',
                    delta: 1,
                    targetSquadId: 'enemy',
                    text: `${userTeamName} steals the traitor swing`,
                    duration: 750,
                });
            } else {
                cpuCombatPoints += 1;
                logs.push(`${roleDisplayName}: ${userChar.name} loses to ${cpuChar.name}.`);
                replayEvents.push({
                    type: 'score',
                    phase: 'combat',
                    role,
                    winnerSquadId: 'enemy',
                    delta: 1,
                    targetSquadId: 'enemy',
                    text: `${cpuTeamName} secures the ${replayRoleLabel.toLowerCase()} point`,
                    duration: 750,
                });
            }
        } else {
            logs.push(`${roleDisplayName}: EXACT TIE. Nobody scores.`);
            replayEvents.push({
                type: 'attack',
                phase: 'combat',
                role,
                actorId: userChar.id,
                targetId: cpuChar.id,
                actorSquadId: 'player',
                targetSquadId: 'enemy',
                text: `${userChar.name} and ${cpuChar.name} clash to a draw`,
                duration: 1050,
            });
        }

        logs.push(`  > ${userTeamName}: (${userStars}*20) + Math.log(${userChar.stats.favorites}) = ${userPower.toFixed(1)}`);
        logs.push(`  > ${cpuTeamName}: (${cpuStars}*20) + Math.log(${cpuChar.stats.favorites}) = ${cpuPower.toFixed(1)}`);
        replayEvents.push({
            type: 'round-end',
            phase: 'combat',
            role,
            targetSquadId: 'enemy',
            text: `${replayRoleLabel} lane resolved`,
            duration: 450,
        });
    }

    logs.push(`\nCOMBAT SCORE: ${userTeamName} ${userCombatPoints} | ${cpuTeamName} ${cpuCombatPoints}`);

    const userBreakdown = calculateScoreBreakdown(userTeam, roles, userCombatPoints);
    const cpuBreakdown = calculateScoreBreakdown(cpuTeam, roles, cpuCombatPoints);
    const breakdowns = { user: userBreakdown, cpu: cpuBreakdown };
    const teamNames = { user: userTeamName, cpu: cpuTeamName };

    appendBonusScoringLogs(logs, ['user', 'cpu'], teamNames, breakdowns);

    const resolution = resolveWinner(['user', 'cpu'], breakdowns);
    const userScore = userBreakdown.totalPoints;
    const cpuScore = cpuBreakdown.totalPoints;
    const tiebreakLog = buildTiebreakLog(resolution, teamNames, breakdowns);

    logs.push(`\nTOTAL SCORE: ${userTeamName} ${userScore} | ${cpuTeamName} ${cpuScore}`);
    if (tiebreakLog) {
        logs.push(tiebreakLog);
    }
    replayEvents.push({
        type: 'final',
        phase: 'resolution',
        winnerSquadId: resolution.winnerId === 'user' ? 'player' : 'enemy',
        text: `Final broadcast: ${resolution.winnerId === 'user' ? userTeamName : cpuTeamName} wins ${userScore} - ${cpuScore}.`,
        duration: 1200,
    });

    return {
        isWin: resolution.winnerId === 'user',
        userScore,
        cpuScore,
        logs,
        userBreakdown,
        cpuBreakdown,
        replayEvents,
    };
}

export function simulateMultiplayerMatchup(
    teams: { [userId: string]: (CharacterItem | null)[] },
    roles: RoleKey[],
    teamNames: { [userId: string]: string }
): MultiplayerBattleResult {
    const playerIds = Object.keys(teams);
    const logs: string[] = [];
    const combatScores: { [userId: string]: number } = {};
    const effectiveStarsByPlayer: { [userId: string]: number[] } = {};

    for (const playerId of playerIds) {
        combatScores[playerId] = 0;
        effectiveStarsByPlayer[playerId] = teams[playerId].map((char, index) =>
            char ? getRoleStars(char, roles[index]) : 0
        );
    }

    const supportIndex = roles.indexOf('support');
    const auraIndex = roles.indexOf('aura');
    const traitorIndex = roles.indexOf('traitor');

    logs.push('\n--- PRE-BATTLE MODIFIERS ---');

    if (supportIndex !== -1) {
        for (const playerId of playerIds) {
            applyPreBattleModifier(
                teams[playerId],
                teams[playerId],
                effectiveStarsByPlayer[playerId],
                effectiveStarsByPlayer[playerId],
                'support',
                supportIndex,
                true,
                teamNames[playerId] || playerId,
                teamNames[playerId] || playerId,
                logs
            );
        }
    }

    if (auraIndex !== -1) {
        for (const sourcePlayerId of playerIds) {
            for (const targetPlayerId of playerIds.filter((playerId) => playerId !== sourcePlayerId)) {
                applyPreBattleModifier(
                    teams[sourcePlayerId],
                    teams[targetPlayerId],
                    effectiveStarsByPlayer[sourcePlayerId],
                    effectiveStarsByPlayer[targetPlayerId],
                    'aura',
                    auraIndex,
                    false,
                    teamNames[sourcePlayerId] || sourcePlayerId,
                    teamNames[targetPlayerId] || targetPlayerId,
                    logs
                );
            }
        }
    }

    if (traitorIndex !== -1) {
        for (const playerId of playerIds) {
            applyPreBattleModifier(
                teams[playerId],
                teams[playerId],
                effectiveStarsByPlayer[playerId],
                effectiveStarsByPlayer[playerId],
                'traitor',
                traitorIndex,
                false,
                teamNames[playerId] || playerId,
                teamNames[playerId] || playerId,
                logs
            );
        }
    }

    logs.push('\n--- COMBAT PHASE ---');

    for (let index = 0; index < roles.length; index++) {
        const role = roles[index];
        const roleDisplayName = role.toUpperCase();
        const isTraitorRound = role === 'traitor';

        const contenders = playerIds
            .map((playerId) => {
                const char = teams[playerId][index];
                if (!char) return null;

                const stars = effectiveStarsByPlayer[playerId][index];
                return {
                    playerId,
                    playerName: teamNames[playerId] || playerId,
                    char,
                    stars,
                    power: calculateCharacterPower(char, role, stars),
                };
            })
            .filter(Boolean) as Array<{
                playerId: string;
                playerName: string;
                char: CharacterItem;
                stars: number;
                power: number;
            }>;

        if (contenders.length < 2) {
            logs.push(`${roleDisplayName}: ROUND DREW (Not enough combatants)`);
            continue;
        }

        const targetPower = isTraitorRound
            ? Math.min(...contenders.map((entry) => entry.power))
            : Math.max(...contenders.map((entry) => entry.power));

        const winners = contenders.filter((entry) => Math.abs(entry.power - targetPower) < 0.0001);

        if (winners.length === 1) {
            const winner = winners[0];
            combatScores[winner.playerId] += 1;

            if (isTraitorRound) {
                logs.push(
                    `${roleDisplayName}: ${winner.playerName}'s ${winner.char.name} survives the traitor penalty and wins the role (${winner.power.toFixed(1)}).`
                );
            } else {
                logs.push(`${roleDisplayName}: ${winner.playerName}'s ${winner.char.name} wins the role (${winner.power.toFixed(1)}).`);
            }
        } else {
            logs.push(`${roleDisplayName}: EXACT TIE between ${winners.map((entry) => entry.playerName).join(', ')}. Nobody scores.`);
        }

        for (const entry of contenders) {
            logs.push(
                `  > ${entry.playerName}: ${entry.char.name} (${entry.stars}*20) + Math.log(${entry.char.stats.favorites}) = ${entry.power.toFixed(1)}`
            );
        }
    }

    logs.push(
        `\nCOMBAT SCORE: ${playerIds.map((playerId) => `${teamNames[playerId] || playerId} ${combatScores[playerId]}`).join(' | ')}`
    );

    return finalizeMultiplayerScores(teams, roles, teamNames, combatScores, logs);
}
