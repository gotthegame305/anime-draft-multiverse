import { CharacterItem, RoleStats } from '@/app/actions';

export type RoleKey = keyof RoleStats;

export interface BattleResult {
    isWin: boolean;
    userScore: number;
    cpuScore: number; // or Enemy Score
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
