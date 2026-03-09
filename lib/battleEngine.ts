import { CharacterItem, RoleStats } from '@/app/actions';

export type RoleKey = keyof RoleStats;

export interface BattleResult {
    isWin: boolean;
    userScore: number;
    cpuScore: number; // or Enemy Score
    logs: string[];
}

export interface MultiplayerBattleResult {
    winnerId: string;
    scores: { [userId: string]: number };
    logs: string[];
}

export function calculateCharacterPower(char: CharacterItem, role: RoleKey, effectiveStars: number): number {
    const favorites = char.stats?.favorites || 100;
    const base = Math.log(favorites);
    return (effectiveStars * 20) + base;
}

function getModifierTarget(team: (CharacterItem | null)[], effectiveStars: number[], type: 'random' | 'lowest' | 'highest', excludeIndex: number): number {
    let targetIndex = -1;
    let targetVal = type === 'lowest' ? Infinity : -Infinity;
    
    // valid targets are non-null characters
    const validIndices = team.map((c, i) => c !== null && i !== excludeIndex ? i : -1).filter(i => i !== -1);
    
    if (validIndices.length === 0) return -1;

    if (type === 'random') {
        return validIndices[Math.floor(Math.random() * validIndices.length)];
    }

    for (const i of validIndices) {
        const stars = effectiveStars[i];
        if (type === 'lowest' && stars < targetVal) {
            targetVal = stars;
            targetIndex = i;
        }
        if (type === 'highest' && stars > targetVal) {
            targetVal = stars;
            targetIndex = i;
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
    logs: string[]
) {
    const modifierChar = sourceTeam[modifierIndex];
    if (!modifierChar) return;
    
    const modifierStars = sourceEffectiveStars[modifierIndex];
    const change = isBuff ? 1 : -1;
    const actionText = isBuff ? 'buffs' : 'sabotages';

    logs.push(`✨ ${teamName}'s ${modifierRole.toUpperCase()} (${modifierChar.name}) activates! (${modifierStars}★)`);

    if (modifierStars <= 2) {
        const targetIdx = getModifierTarget(targetTeam, targetEffectiveStars, 'random', isBuff ? modifierIndex : -1);
        if (targetIdx !== -1) {
            targetEffectiveStars[targetIdx] = Math.max(1, targetEffectiveStars[targetIdx] + change);
            logs.push(`   ↳ ${actionText} ${targetTeamName}'s Random slot by 1 star.`);
        }
    } else if (modifierStars === 3) {
        const targetIdx = getModifierTarget(targetTeam, targetEffectiveStars, 'lowest', isBuff ? modifierIndex : -1);
        if (targetIdx !== -1) {
            targetEffectiveStars[targetIdx] = Math.max(1, targetEffectiveStars[targetIdx] + change);
            logs.push(`   ↳ ${actionText} ${targetTeamName}'s Lowest Star slot by 1 star.`);
        }
    } else if (modifierStars === 4) {
        const targetIdx = getModifierTarget(targetTeam, targetEffectiveStars, 'highest', isBuff ? modifierIndex : -1);
        if (targetIdx !== -1) {
            targetEffectiveStars[targetIdx] = Math.max(1, targetEffectiveStars[targetIdx] + change);
            logs.push(`   ↳ ${actionText} ${targetTeamName}'s Highest Star slot by 1 star.`);
        }
    } else if (modifierStars >= 5) {
        for (let i = 0; i < targetTeam.length; i++) {
            if (targetTeam[i]) {
                targetEffectiveStars[i] = Math.max(1, targetEffectiveStars[i] + change);
            }
        }
        logs.push(`   ↳ ${actionText} ALL of ${targetTeamName}'s characters by 1 star.`);
    }
}

export function simulateMatchup(
    userTeam: (CharacterItem | null)[], 
    cpuTeam: (CharacterItem | null)[], 
    roles: RoleKey[],
    userTeamName: string = "You",
    cpuTeamName: string = "CPU"
): BattleResult {
    let userScore = 0;
    let cpuScore = 0;
    const logs: string[] = [];

    // 1. Initialize effective stars
    const userEffectiveStars: number[] = userTeam.map((c, i) => c ? Number(c.stats.roleStats[roles[i]] || 1) : 0);
    const cpuEffectiveStars: number[] = cpuTeam.map((c, i) => c ? Number(c.stats.roleStats[roles[i]] || 1) : 0);

    // 2. Look for Modifiers in the drafted roles
    const supportIndex = roles.indexOf('support');
    const auraIndex = roles.indexOf('aura');
    const traitorIndex = roles.indexOf('traitor');

    logs.push(`\n🎲 --- PRE-BATTLE MODIFIERS ---`);

    // Support buffs allies
    if (supportIndex !== -1) {
        applyPreBattleModifier(userTeam, userTeam, userEffectiveStars, userEffectiveStars, 'support', supportIndex, true, userTeamName, userTeamName, logs);
        applyPreBattleModifier(cpuTeam, cpuTeam, cpuEffectiveStars, cpuEffectiveStars, 'support', supportIndex, true, cpuTeamName, cpuTeamName, logs);
    }

    // Aura debuffs enemies
    if (auraIndex !== -1) {
        applyPreBattleModifier(userTeam, cpuTeam, userEffectiveStars, cpuEffectiveStars, 'aura', auraIndex, false, userTeamName, cpuTeamName, logs);
        applyPreBattleModifier(cpuTeam, userTeam, cpuEffectiveStars, userEffectiveStars, 'aura', auraIndex, false, cpuTeamName, userTeamName, logs);
    }

    // Traitor debuffs allies
    if (traitorIndex !== -1) {
        applyPreBattleModifier(userTeam, userTeam, userEffectiveStars, userEffectiveStars, 'traitor', traitorIndex, false, userTeamName, userTeamName, logs);
        applyPreBattleModifier(cpuTeam, cpuTeam, cpuEffectiveStars, cpuEffectiveStars, 'traitor', traitorIndex, false, cpuTeamName, cpuTeamName, logs);
    }

    logs.push(`\n⚔️ --- COMBAT PHASE ---`);

    // 3. Round by Round Combat
    for (let i = 0; i < roles.length; i++) {
        const role = roles[i];
        const roleDisplayName = role.toUpperCase();

        const userChar = userTeam[i];
        const cpuChar = cpuTeam[i];

        if (!userChar || !cpuChar) {
            logs.push(`${roleDisplayName}: ROUND DREW (Missing Character)`);
            continue;
        }

        const userStars = userEffectiveStars[i];
        const cpuStars = cpuEffectiveStars[i];

        const userTotal = calculateCharacterPower(userChar, role, userStars);
        const cpuTotal = calculateCharacterPower(cpuChar, role, cpuStars);

        const isTraitorRound = role === 'traitor';

        if (userTotal > cpuTotal) {
            if (isTraitorRound) {
                cpuScore++;
                logs.push(`${roleDisplayName} (Traitor Penalty!): ❌ ${userChar.name} (Pwr: ${userTotal.toFixed(1)}) GIVES POINT TO ${cpuTeamName}!`);
            } else {
                userScore++;
                logs.push(`${roleDisplayName}: ✅ ${userChar.name} (Pwr: ${userTotal.toFixed(1)}) DEFEATS ❌ ${cpuChar.name} (Pwr: ${cpuTotal.toFixed(1)})`);
            }
        } else if (cpuTotal > userTotal) {
            if (isTraitorRound) {
                userScore++;
                logs.push(`${roleDisplayName} (Traitor Penalty!): ✅ ${cpuTeamName}'s ${cpuChar.name} (Pwr: ${cpuTotal.toFixed(1)}) GIVES POINT TO YOU!`);
            } else {
                cpuScore++;
                logs.push(`${roleDisplayName}: ❌ ${userChar.name} (Pwr: ${userTotal.toFixed(1)}) LOSES TO ✅ ${cpuChar.name} (Pwr: ${cpuTotal.toFixed(1)})`);
            }
        } else {
            logs.push(`${roleDisplayName}: ⚖️ EXACT TIE! Nobody scores.`);
        }

        logs.push(`   > ${userTeamName}: (${userStars}⭐ * 20) + Math.log(${userChar.stats.favorites}) = ${userTotal.toFixed(1)}`);
        logs.push(`   > ${cpuTeamName}: (${cpuStars}⭐ * 20) + Math.log(${cpuChar.stats.favorites}) = ${cpuTotal.toFixed(1)}`);
    }

    const isWin = userScore > cpuScore;
    logs.push(`\nFINAL SCORE: ${userScore}-${cpuScore} ${isWin ? '(VICTORY!)' : '(DEFEAT!)'}`);

    return { isWin, userScore, cpuScore, logs };
}

export function simulateMultiplayerMatchup(
    teams: { [userId: string]: (CharacterItem | null)[] },
    roles: RoleKey[],
    teamNames: { [userId: string]: string }
): MultiplayerBattleResult {
    const playerIds = Object.keys(teams);
    const logs: string[] = [];
    const scores: { [userId: string]: number } = {};
    const effectiveStarsByPlayer: { [userId: string]: number[] } = {};

    playerIds.forEach((playerId) => {
        scores[playerId] = 0;
        effectiveStarsByPlayer[playerId] = teams[playerId].map((char, index) =>
            char ? Number(char.stats.roleStats[roles[index]] || 1) : 0
        );
    });

    const supportIndex = roles.indexOf('support');
    const auraIndex = roles.indexOf('aura');
    const traitorIndex = roles.indexOf('traitor');

    logs.push('\n--- PRE-BATTLE MODIFIERS ---');

    if (supportIndex !== -1) {
        playerIds.forEach((playerId) => {
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
        });
    }

    if (auraIndex !== -1) {
        playerIds.forEach((sourcePlayerId) => {
            playerIds
                .filter((targetPlayerId) => targetPlayerId !== sourcePlayerId)
                .forEach((targetPlayerId) => {
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
                });
        });
    }

    if (traitorIndex !== -1) {
        playerIds.forEach((playerId) => {
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
        });
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
            scores[winner.playerId] += 1;

            if (isTraitorRound) {
                logs.push(
                    `${roleDisplayName}: ${winner.playerName}'s ${winner.char.name} survives the traitor penalty and wins the role (${winner.power.toFixed(1)})`
                );
            } else {
                logs.push(
                    `${roleDisplayName}: ${winner.playerName}'s ${winner.char.name} wins the role (${winner.power.toFixed(1)})`
                );
            }
        } else {
            logs.push(
                `${roleDisplayName}: EXACT TIE between ${winners.map((entry) => entry.playerName).join(', ')}. Nobody scores.`
            );
        }

        contenders.forEach((entry) => {
            logs.push(
                `   > ${entry.playerName}: ${entry.char.name} (${entry.stars}*20) + Math.log(${entry.char.stats.favorites}) = ${entry.power.toFixed(1)}`
            );
        });
    }

    const sortedPlayers = [...playerIds].sort((a, b) => scores[b] - scores[a]);
    const topScore = scores[sortedPlayers[0]] ?? 0;
    const topPlayers = sortedPlayers.filter((playerId) => scores[playerId] === topScore);
    const winnerId = topPlayers[0];

    if (topPlayers.length > 1) {
        logs.push(
            `\nFINAL SCORE: ${sortedPlayers.map((playerId) => `${teamNames[playerId] || playerId} ${scores[playerId]}`).join(' | ')}`
        );
        logs.push(`TIEBREAKER: ${teamNames[winnerId] || winnerId} wins on player-order tiebreak.`);
    } else {
        logs.push(
            `\nFINAL SCORE: ${sortedPlayers.map((playerId) => `${teamNames[playerId] || playerId} ${scores[playerId]}`).join(' | ')}`
        );
    }

    return { winnerId, scores, logs };
}
