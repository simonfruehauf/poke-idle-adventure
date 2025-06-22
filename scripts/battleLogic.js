// scripts/battleLogic.js
import { gameState, routes, pokeballData, pokemonBaseStatsData, eventDefinitions } from './state.js';
import { Pokemon } from './pokemon.js';
import { addBattleLog, getActivePokemon, findNextHealthyPokemon, formatNumberWithDots } from './utils.js';
import { updateDisplay, updateWildPokemonDisplay, populateRouteSelector, showEventModal } from './ui.js';
import { AUTO_FIGHT_UNLOCK_WINS, XP_SHARE_CONFIG, XP_LEVEL_DIFF_FACTOR, XP_MULTIPLIER_MIN, XP_MULTIPLIER_MAX, getTypeEffectiveness } from './config.js';
// Note: leaveCurrentRoute and toggleAutoFight might be called from here if a battle outcome dictates it.
// If they remain in gameLogic.js, we'll need to import them or handle the logic flow differently.
// For now, assuming they might be called and will be handled by gameLogic.js coordinator.
import { leaveCurrentRoute } from './routeLogic.js'; // Corrected import
import { toggleAutoFight, checkAndTriggerPostBattleEvent } from './gameLogic.js'; // toggleAutoFight and checkAndTriggerPostBattleEvent are in gameLogic.js


export async function manualBattle() {
    if (gameState.battleInProgress || gameState.autoBattleActive || gameState.eventModalActive) {
        if (gameState.autoBattleActive) addBattleLog("Disable Auto-Fight to fight manually.");
        return;
    }

    let activePokemon = getActivePokemon();
    if (!activePokemon || activePokemon.currentHp <= 0) {
        const nextPokemon = findNextHealthyPokemon();
        if (!nextPokemon) {
            addBattleLog("No healthy Pokemon available! Heal your party!");
            return;
        }
        addBattleLog(`Your ${activePokemon ? activePokemon.name : 'Pokemon'} has fainted! Select another Pokemon.`);
        return;
    }

    if (!gameState.currentWildPokemon) {
        await spawnWildPokemon(); // ensure spawn is awaited
        if (gameState.currentWildPokemon) {
            addBattleLog(`A wild ${gameState.currentWildPokemon.name} appeared! Press Fight to battle.`);
        }
        updateDisplay();
        return;
    }
    await battle();
}


export async function spawnWildPokemon() {
    const route = routes[gameState.currentRoute];
    if (!route) {
        addBattleLog(`No route data for Route ${gameState.currentRoute}. Cannot find Pokémon.`);
        return;
    }
    const availablePokemon = route.pokemon;
    if (!availablePokemon || availablePokemon.length === 0) {
        gameState.currentWildPokemon = null;
        addBattleLog(`No Pokémon available on ${route.name}.`);
        updateWildPokemonDisplay();
        return;
    }

    const totalChance = availablePokemon.reduce((sum, pkmn) => sum + pkmn.chance, 0);
    let randomRoll = Math.random() * totalChance;
    let selectedPokemonData;
    for (const pkmn of availablePokemon) {
        if (randomRoll < pkmn.chance) {
            selectedPokemonData = pkmn;
            break;
        }
        randomRoll -= pkmn.chance;
    }
    if (!selectedPokemonData) selectedPokemonData = availablePokemon[0];

    const level = Math.floor(Math.random() * (selectedPokemonData.levelRange[1] - selectedPokemonData.levelRange[0] + 1)) + selectedPokemonData.levelRange[0];
    gameState.currentWildPokemon = await Pokemon.create(selectedPokemonData.name, level);
    updateWildPokemonDisplay();
}

export async function battle() {
    let playerPokemon = getActivePokemon();
    if (!playerPokemon || playerPokemon.currentHp <= 0) {
        const nextPokemon = findNextHealthyPokemon();
        if (!nextPokemon) {
            addBattleLog("No healthy Pokemon available! Heal your party!");
            if (gameState.autoBattleActive) await toggleAutoFight(); // Stop auto-battle
            return;
        }
        gameState.activePokemonIndex = gameState.party.indexOf(nextPokemon);
        playerPokemon = getActivePokemon();
    }

    if (!gameState.currentWildPokemon) {
        addBattleLog("No wild Pokémon to battle!");
        return;
    }

    gameState.battleInProgress = true;
    updateDisplay();

    const wildPokemon = gameState.currentWildPokemon;
    const currentRouteData = routes[gameState.currentRoute];

    let firstAttacker, secondAttacker, firstIsPlayer;
    if (playerPokemon.speed >= wildPokemon.speed) {
        firstAttacker = playerPokemon; secondAttacker = wildPokemon; firstIsPlayer = true;
    } else {
        firstAttacker = wildPokemon; secondAttacker = playerPokemon; firstIsPlayer = false;
    }

    addBattleLog(`${firstAttacker.name} attacks first!`);
    await new Promise(resolve => setTimeout(resolve, 300));

    const damageResultFirst = calculateDamage(firstAttacker, secondAttacker);
    const secondAttackerFainted = secondAttacker.takeDamage(damageResultFirst.damage);
    let effectivenessMessageFirst = getEffectivenessMessage(firstAttacker, secondAttacker.primaryType, damageResultFirst.usedType);
    if (damageResultFirst.damage === 0) { addBattleLog(`${firstAttacker.name} deals no damage to ${secondAttacker.name}! ${effectivenessMessageFirst}`); }
    else { addBattleLog(`${firstAttacker.name} deals ${damageResultFirst.damage} ${damageResultFirst.usedType} damage to ${secondAttacker.name}! ${effectivenessMessageFirst}`); }

    updateDisplay();

    if (secondAttackerFainted) {
        await handleFaint(secondAttacker, firstAttacker, !firstIsPlayer, currentRouteData);
        gameState.battleInProgress = false;
        updateDisplay();
        return;
    }

    if (secondAttacker.currentHp > 0 && firstAttacker.currentHp > 0) {
        addBattleLog(`${secondAttacker.name} attacks!`);
        await new Promise(resolve => setTimeout(resolve, 300));
        const damageResultSecond = calculateDamage(secondAttacker, firstAttacker);
        let effectivenessMessageSecond = getEffectivenessMessage(secondAttacker, firstAttacker.primaryType, damageResultSecond.usedType);
        const firstAttackerFainted = firstAttacker.takeDamage(damageResultSecond.damage);
        if (damageResultSecond.damage === 0) { addBattleLog(`${secondAttacker.name} deals no damage to ${firstAttacker.name}! ${effectivenessMessageSecond}`); }
        else { addBattleLog(`${secondAttacker.name} deals ${damageResultSecond.damage} ${damageResultSecond.usedType} damage to ${firstAttacker.name}! ${effectivenessMessageSecond}`); }

        updateDisplay();

        if (firstAttackerFainted) {
            await handleFaint(firstAttacker, secondAttacker, firstIsPlayer, currentRouteData);
        }
    }

    gameState.battleInProgress = false;
    updateDisplay();
}

function getEffectivenessMessage(attacker, defenderType, usedAttackerType) {
    const effectiveness = getTypeEffectiveness(usedAttackerType, defenderType);
    let message = "";

    if (attacker.types.length > 1 && usedAttackerType !== attacker.primaryType) {
        const formattedUsedType = usedAttackerType.charAt(0).toUpperCase() + usedAttackerType.slice(1);
        message += `(using its ${formattedUsedType} type) `;
    }
    if (effectiveness > 1) return message + "It's super effective!";
    if (effectiveness < 1 && effectiveness > 0) return message + "It's not very effective...";
    if (effectiveness === 0) return `${message}It had no effect on ${defenderType} type!`;
    return message; // Returns empty or just the type usage message if normally effective
}


export function calculateDamage(attacker, defender) {
    if (!attacker || !defender) return { damage: 0, usedType: 'Null' };


    let usedAttackerType;
    if (attacker.types.length > 1 && Math.random() < 0.25) {
        usedAttackerType = attacker.types[1];
    }
    else {
        usedAttackerType = attacker.primaryType
    }
    const effectiveness = getTypeEffectiveness(usedAttackerType, defender.primaryType);
    const basePower = 50; // Simplified base power
    let random = Math.random() * 0.15 + 0.85; // Random factor between 0.85 and 1.00
    let damage = Math.floor(((2 * attacker.level / 4.5 + 2) * basePower * attacker.attack / defender.defense / 50 + 2) * effectiveness * random);
    return { damage, usedType: usedAttackerType };
}


export async function handleFaint(faintedPokemon, victorPokemon, faintedWasPlayerPokemon, currentRouteData) {
    addBattleLog(`${faintedPokemon.name} fainted!`);
    updateDisplay();
    await new Promise(resolve => setTimeout(resolve, 1200));

    if (faintedWasPlayerPokemon) {
        const nextPokemon = findNextHealthyPokemon();
        if (nextPokemon) {
            gameState.activePokemonIndex = gameState.party.indexOf(nextPokemon);
            addBattleLog(`Go, ${nextPokemon.name}!`);
        } else {
            addBattleLog("All your Pokemon fainted!");
            gameState.battleInProgress = false;
            if (gameState.autoBattleActive) {
                await toggleAutoFight();
            }
            if (gameState.currentRoute !== null) {
                await leaveCurrentRoute();
            } else {
                updateDisplay();
            }
        }
    } else { // Wild Pokemon fainted
        const baseExp = faintedPokemon.level * 20;
        const levelDifference = faintedPokemon.level - victorPokemon.level;
        let xpMultiplier = 1 + (levelDifference * XP_LEVEL_DIFF_FACTOR);
        xpMultiplier = Math.max(XP_MULTIPLIER_MIN, Math.min(xpMultiplier, XP_MULTIPLIER_MAX));
        const expGained = Math.max(1, Math.floor(baseExp * xpMultiplier));

        const moneyGained = Math.floor((Math.sqrt(faintedPokemon.level) / 2.0) * 15.0 * (currentRouteData ? currentRouteData.moneyMultiplier : 1));
        victorPokemon.gainExp(expGained);
        gameState.money += moneyGained;
        gameState.battleWins++;
        if (!gameState.autoFightUnlocked && gameState.battleWins >= AUTO_FIGHT_UNLOCK_WINS) {
            gameState.autoFightUnlocked = true; addBattleLog("Auto-Fight Unlocked!");
        }
        addBattleLog(`Gained ${expGained} EXP and ${formatNumberWithDots(moneyGained)}₽!`);

        if (gameState.xpShareLevel > 0 && gameState.xpShareLevel <= XP_SHARE_CONFIG.length) {
            const currentXpShare = XP_SHARE_CONFIG[gameState.xpShareLevel - 1];
            gameState.party.forEach(p => {
                if (p && p.id !== victorPokemon.id && p.currentHp > 0) {
                    const levelDifferenceP = faintedPokemon.level - p.level;
                    let xpMultiplierP = 1 + (levelDifferenceP * XP_LEVEL_DIFF_FACTOR);
                    xpMultiplierP = Math.max(XP_MULTIPLIER_MIN, Math.min(xpMultiplierP, XP_MULTIPLIER_MAX));
                    const sharedExpBase = Math.max(1, Math.floor(baseExp * xpMultiplierP));
                    const rawSharedExp = sharedExpBase * currentXpShare.percentage;
                    let sharedExpAmount = Math.floor(rawSharedExp);
                    if (rawSharedExp > 0 && sharedExpAmount === 0) sharedExpAmount = 1;
                    p.gainExp(sharedExpAmount);
                }
            });
        }
        gameState.currentWildPokemon = null;
        populateRouteSelector();
        await checkAndTriggerPostBattleEvent();
    }
}

export async function attemptCatch(ballId = 'pokeball') {
    if (gameState.eventModalActive) { addBattleLog("Acknowledge the current event first!"); return; }
    if (!gameState.currentWildPokemon) { addBattleLog("No wild Pokémon to catch!"); return; }

    gameState.battleInProgress = true; updateDisplay();
    if (!gameState.pokeballs[ballId] || gameState.pokeballs[ballId] <= 0) {
        addBattleLog(`No ${pokeballData[ballId]?.name || ballId} left!`);
        gameState.battleInProgress = false; updateDisplay();
        return;
    }
    gameState.pokeballs[ballId]--;
    const ballUsed = pokeballData[ballId] || pokeballData.pokeball;
    addBattleLog(`Used 1 ${ballUsed.name} on ${gameState.currentWildPokemon.nickname || gameState.currentWildPokemon.name}...`);

    const wildPokemon = gameState.currentWildPokemon;
    let catchChance;

    if (ballId === 'masterball') {
        catchChance = 1.0;
    } else {
        const healthMultiplier = Math.pow(1 + (((wildPokemon.maxHp - wildPokemon.currentHp) / wildPokemon.maxHp)), 2.0);
        const levelPenalty = Math.max(0.15, 1 - (wildPokemon.level / 100));
        catchChance = 0.25 * healthMultiplier * levelPenalty * ballUsed.modifier;
        catchChance = Math.max(0.04, Math.min(catchChance, 0.99));
    }
    console.log("Catch chance: ", catchChance * 100, "%");

    await new Promise(resolve => setTimeout(resolve, 500)); // Simulating catch attempt time

    if (Math.random() < catchChance) {
        const caughtPokemon = await Pokemon.create(wildPokemon.name, wildPokemon.level, wildPokemon.isShiny, ballId);
        caughtPokemon.currentHp = wildPokemon.currentHp;
        if (ballId === 'healball') caughtPokemon.heal();
        const emptySlot = gameState.party.findIndex(slot => slot === null);
        if (emptySlot !== -1) {
            gameState.party[emptySlot] = caughtPokemon; addBattleLog(`${caughtPokemon.nickname || caughtPokemon.name} was added to your party!`);
        } else {
            gameState.allPokemon.push(caughtPokemon); addBattleLog(`${caughtPokemon.nickname || caughtPokemon.name} was sent to your PC.`);
        }
        gameState.currentWildPokemon = null;
        populateRouteSelector();
        await checkAndTriggerPostBattleEvent();
    } else {
        addBattleLog(`${wildPokemon.name} broke free!`);
        const playerPokemon = getActivePokemon();
        if (playerPokemon && playerPokemon.currentHp > 0 && wildPokemon.currentHp > 0) {
            addBattleLog(`${wildPokemon.nickname || wildPokemon.name} attacks!`);
            const wildDamageResult = calculateDamage(wildPokemon, playerPokemon);
            let effectivenessMessage = getEffectivenessMessage(wildPokemon, playerPokemon.primaryType, wildDamageResult.usedType);
            const playerDefeated = playerPokemon.takeDamage(wildDamageResult.damage);
            if (wildDamageResult.damage === 0) { addBattleLog(`${wildPokemon.nickname || wildPokemon.name} deals no damage to ${playerPokemon.nickname || playerPokemon.name}! ${effectivenessMessage}`); }
            else { addBattleLog(`${wildPokemon.name} deals ${wildDamageResult.damage} ${wildDamageResult.usedType} damage to ${playerPokemon.name}! ${effectivenessMessage}`); }
            if (playerDefeated) {
                await handleFaint(playerPokemon, wildPokemon, true, routes[gameState.currentRoute]);
            }
        }
    }
    gameState.battleInProgress = false; updateDisplay();
}

export async function autoBattleTick() {
    if (!gameState.autoBattleActive || gameState.battleInProgress || gameState.eventModalActive || gameState.currentRoute === null) return;
    let playerPokemon = getActivePokemon();
    if (!playerPokemon || playerPokemon.currentHp <= 0) {
        const nextPokemon = findNextHealthyPokemon();
        if (nextPokemon) {
            gameState.activePokemonIndex = gameState.party.indexOf(nextPokemon);
            playerPokemon = nextPokemon; addBattleLog(`Auto-Switch: Go, ${playerPokemon.name}!`); updateDisplay();
        } else {
            addBattleLog("All your Pokémon have fainted!");
            if (gameState.currentRoute !== null) await leaveCurrentRoute();
            else await toggleAutoFight(); // if not on a route (e.g. tutorial), just stop auto fight
            return;
        }
    }
    if (!gameState.currentWildPokemon) {
        await spawnWildPokemon();
        if (gameState.currentWildPokemon) { addBattleLog(`Auto-Fight: A wild ${gameState.currentWildPokemon.name} appeared!`); updateDisplay(); }
        else { updateDisplay(); return; } // No Pokémon spawned or available
    }
    // Ensure wild Pokemon exists and player Pokemon is healthy before battling
    if (gameState.currentWildPokemon && playerPokemon && playerPokemon.currentHp > 0) {
        await battle();
    }
}
