// gameLogic.js
import { gameState, routes, pokeballData, itemData, pokemonBaseStatsData, eventDefinitions } from './state.js';
import { Pokemon } from './pokemon.js';
import { addBattleLog, getActivePokemon, findNextHealthyPokemon, formatNumberWithDots } from './utils.js'; // XP_LEVEL_DIFF_FACTOR, XP_MULTIPLIER_MIN, XP_MULTIPLIER_MAX
import { updateDisplay, updateWildPokemonDisplay, populateRouteSelector, showEventModal, closeEventModal, displayPokemonData } from './ui.js';
import { AUTO_FIGHT_UNLOCK_WINS, XP_SHARE_CONFIG, XP_LEVEL_DIFF_FACTOR, XP_MULTIPLIER_MIN, XP_MULTIPLIER_MAX, getTypeEffectiveness } from './config.js';


let autoFightIntervalId = null;

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
        spawnWildPokemon();
        if (gameState.currentWildPokemon) {
            addBattleLog(`A wild ${gameState.currentWildPokemon.name} appeared! Press Fight to battle.`);
        }
        updateDisplay();
        return;
    }
    await battle();
}

export function handleRouteChange(routeNumStr) {
    if (routeNumStr === "") {
        if (gameState.currentRoute !== null) leaveCurrentRoute();
        return;
    }
    const routeNum = parseInt(routeNumStr);
    if (!isNaN(routeNum)) {
        changeRoute(routeNum);
    }
}

export function changeRoute(routeNum) {
    if (gameState.autoBattleActive) {
        addBattleLog("Stop Auto-Fight before changing routes.");
        updateDisplay(); // To correctly show route selector if it was hidden
        populateRouteSelector(); // Ensure dropdown is correctly valued
        return;
    }
    if (gameState.battleInProgress) {
        addBattleLog("Cannot change routes during a battle action.");
        populateRouteSelector();
        return;
    }
    if (gameState.currentRoute === routeNum && gameState.currentWildPokemon) {
        addBattleLog(`Already on ${routes[routeNum] ? routes[routeNum].name : 'this route'}.`);
        populateRouteSelector();
        return;
    }
    gameState.currentRoute = routeNum;

    if (routes && routes[routeNum]) {
        document.getElementById('route-info').textContent = routes[routeNum].description;
    } else {
        document.getElementById('route-info').textContent = "Loading route info...";
    }
    gameState.currentWildPokemon = null;
    addBattleLog(`Moved to ${routes[routeNum] ? routes[routeNum].name : 'selected route'}. Press "Find Pokémon" to search.`);
    populateRouteSelector();
    updateDisplay();
}

export function leaveCurrentRoute() {
    if (gameState.currentRoute === null) {
        addBattleLog("Not currently on any route.");
        return;
    }
    if (gameState.battleInProgress) {
        addBattleLog("Cannot leave route during a battle action.");
        return;
    }
    addBattleLog(`You have left ${routes[gameState.currentRoute] ? routes[gameState.currentRoute].name : 'the current route'}.`);
    gameState.currentRoute = null;
    gameState.currentWildPokemon = null;
    document.getElementById('route-info').textContent = "Not currently on a route. Select a route to find Pokémon.";
    if (gameState.autoBattleActive) {
        toggleAutoFight(); // This will stop auto-fight
    }
    populateRouteSelector();
    updateDisplay();
}

export function calculateAveragePartyLevel() {
    const activeParty = gameState.party.filter(p => p !== null);
    if (activeParty.length === 0) return 0;
    const totalLevel = activeParty.reduce((sum, p) => sum + p.level, 0);
    return Math.floor(totalLevel / activeParty.length);
}

export function calculateMaxPartyLevel() {
    const activeParty = gameState.party.filter(p => p !== null);
    if (activeParty.length === 0) return 0;
    const maxLevel = activeParty.reduce((max, p) => Math.max(max, p.level), 0);
    return maxLevel;
}
export function calculateMinPartyLevel() {
    const activeParty = gameState.party.filter(p => p !== null);
    if (activeParty.length === 0) return 0;
    const minLevel = activeParty.reduce((min, p) => Math.min(min, p.level), 100); 
    return minLevel;
}
    
export function spawnWildPokemon() {
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
    gameState.currentWildPokemon = new Pokemon(selectedPokemonData.name, level);
    updateWildPokemonDisplay();
}

export async function battle() {
    let playerPokemon = getActivePokemon(); // Ensure this is declared
    if (!playerPokemon || playerPokemon.currentHp <= 0) {
        const nextPokemon = findNextHealthyPokemon();
        if (!nextPokemon) {
            addBattleLog("No healthy Pokemon available! Heal your party!");
            if (gameState.autoBattleActive) toggleAutoFight(); // Stop auto-battle
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
    if (damageResultFirst.damage == 0) {addBattleLog(`${firstAttacker.name} deals no damage to ${secondAttacker.name}! ${effectivenessMessageFirst}`);}
    else { addBattleLog(`${firstAttacker.name} deals ${damageResultFirst.damage} ${damageResultFirst.usedType} damage to ${secondAttacker.name}! ${effectivenessMessageFirst}`);}
   
    updateDisplay();

    if (secondAttackerFainted) {
        await handleFaint(secondAttacker, firstAttacker, !firstIsPlayer, currentRouteData);
        // Check if the battle should continue (e.g. wild fainted, player still has Pokemon)
        // or if the player's Pokemon fainted and they have another one.
        if (gameState.currentWildPokemon === null && findNextHealthyPokemon()) {
            // Wild Pokemon fainted, player can continue.
            // Potentially spawn next wild Pokemon if auto-battle is on, or wait for player.
        } else if (firstIsPlayer && secondAttackerFainted && !findNextHealthyPokemon()) {
            // Player's Pokemon fainted the wild, but player has no more Pokemon (should not happen if logic is correct)
            // This case is mostly covered by handleFaint.
        } else if (!firstIsPlayer && secondAttackerFainted && !findNextHealthyPokemon()) {
            // Wild Pokemon fainted player's last Pokemon.
            // This is handled by handleFaint.
        }
        gameState.battleInProgress = false;
        // If all player Pokemon fainted, handleFaint would call leaveCurrentRoute.
        // updateDisplay is called by handleFaint or leaveCurrentRoute, but an extra one here ensures UI is current.
        updateDisplay(); 
        return;
    }

    if (secondAttacker.currentHp > 0 && firstAttacker.currentHp > 0) {
        addBattleLog(`${secondAttacker.name} attacks!`);
        await new Promise(resolve => setTimeout(resolve, 300));
        const damageResultSecond = calculateDamage(secondAttacker, firstAttacker);
        let effectivenessMessageSecond = getEffectivenessMessage(secondAttacker, firstAttacker.primaryType, damageResultSecond.usedType);
        const firstAttackerFainted = firstAttacker.takeDamage(damageResultSecond.damage);
        if (damageResultSecond.damage == 0) {addBattleLog(`${secondAttacker.name} deals no damage to ${firstAttacker.name}! ${effectivenessMessageSecond}`);}
        else { addBattleLog(`${secondAttacker.name} deals ${damageResultSecond.damage} ${damageResultSecond.usedType} damage to ${firstAttacker.name}! ${effectivenessMessageSecond}`);}
    
        updateDisplay();

        if (firstAttackerFainted) {
            await handleFaint(firstAttacker, secondAttacker, firstIsPlayer, currentRouteData);
            // If all player Pokemon fainted, handleFaint would call leaveCurrentRoute.
        }
        console.log(damageResultFirst);
        console.log(damageResultSecond);
    }

    gameState.battleInProgress = false;
    updateDisplay();
}

function getEffectivenessMessage(attacker, defenderType, usedAttackerType) {
    const effectiveness = getTypeEffectiveness(usedAttackerType, defenderType);
    let message = "";

    if (attacker.types.length > 1 && usedAttackerType !== attacker.primaryType) {
        // Capitalize the used type for the message
        const formattedUsedType = usedAttackerType.charAt(0).toUpperCase() + usedAttackerType.slice(1);
        message += `(using its ${formattedUsedType} type) `;
    }
    if (effectiveness > 1) return "It's super effective!";
    if (effectiveness < 1 && effectiveness > 0) return "It's not very effective...";
    if (effectiveness === 0) return `${message}It had no effect on ${defenderType} type!`;
    return "";
}

export function calculateDamage(attacker, defender) {
    if (!attacker || !defender) return 0;


    // Gen 1 Damage Formula Structure (ignoring Power, Critical=1, STAB as requested)
    // Formula: ((2 × Level / 5 + 2) × Attack / Defense / 50 + 2) × Type1 × Type2 × random
    
    let usedAttackerType;
    // 25% chance to use secondary type if available
    if (attacker.types.length > 1 && Math.random() < 0.25) {
        usedAttackerType = attacker.types[1];
    }
    else {
        usedAttackerType = attacker.primaryType
    }
    const effectiveness = getTypeEffectiveness(usedAttackerType, defender.primaryType);
    const basePower = 60
    let random = Math.random() * 0.15 + 0.85;
    let damage = Math.floor(((2 * attacker.level / 5 + 2) * basePower * attacker.attack / defender.defense / 50 + 2) * effectiveness * random);
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
            gameState.battleInProgress = false; // Crucial: The battle ends for the player here.
            if (gameState.autoBattleActive) {
                toggleAutoFight(); // Stop auto-fight
            }
            // If on a route and all Pokemon fainted, leave the route.
            if (gameState.currentRoute !== null) {
                leaveCurrentRoute();
            } else {
                // If not on a route (e.g. fainted during a non-route tutorial battle), still update UI.
                updateDisplay();
            }
        }
    } else {
        const baseExp = faintedPokemon.level * 20;
        const levelDifference = faintedPokemon.level - victorPokemon.level; // Positive if wild is higher, negative if player is higher

        // XP Multiplier based on level difference:
        // - Modifies base XP by +/- (XP_LEVEL_DIFF_FACTOR * 100)% per level difference from a base of 1.0x.
        // - Example: If XP_LEVEL_DIFF_FACTOR is 0.08, it's +/- 8% per level.
        // - Capped between XP_MULTIPLIER_MIN and XP_MULTIPLIER_MAX.
        let xpMultiplier = 1 + (levelDifference * XP_LEVEL_DIFF_FACTOR);
        xpMultiplier = Math.max(XP_MULTIPLIER_MIN, Math.min(xpMultiplier, XP_MULTIPLIER_MAX));
        const expGained = Math.max(1, Math.floor(baseExp * xpMultiplier)); // Ensure at least 1 XP

        const moneyGained = Math.floor( (Math.sqrt(faintedPokemon.level)/2.0) * 15.0 * (currentRouteData ? currentRouteData.moneyMultiplier : 1));
        victorPokemon.gainExp(expGained);
        gameState.money += moneyGained;
        gameState.battleWins++;
        if (!gameState.autoFightUnlocked && gameState.battleWins >= AUTO_FIGHT_UNLOCK_WINS) {
            gameState.autoFightUnlocked = true; addBattleLog("Auto-Fight Unlocked!");
        }
        addBattleLog(`Gained ${expGained} EXP and ${formatNumberWithDots(moneyGained)}₽!`);

        if (gameState.xpShareLevel > 0 && gameState.xpShareLevel <= XP_SHARE_CONFIG.length) {
            const currentXpShare = XP_SHARE_CONFIG[gameState.xpShareLevel - 1];
            let sharedCount = 0;
            gameState.party.forEach(p => {
                if (p && p.id !== victorPokemon.id && p.currentHp > 0) {
                    const levelDifferenceP = faintedPokemon.level - p.level; // Positive if wild is higher, negative if player is higher
                    let xpMultiplierp = 1 + (levelDifferenceP * XP_LEVEL_DIFF_FACTOR);
                    xpMultiplierp = Math.max(XP_MULTIPLIER_MIN, Math.min(xpMultiplierp, XP_MULTIPLIER_MAX));
                    const expGained = Math.max(1, Math.floor(baseExp * xpMultiplierp)); // Ensure at least 1 XP

                    const rawSharedExp = expGained * currentXpShare.percentage;

                    let sharedExpAmount = Math.floor(rawSharedExp);
                    if (rawSharedExp > 0 && sharedExpAmount === 0) {
                        sharedExpAmount = 1; // Ensure at least 1 XP is shared if any fraction was calculated
                    }
                    p.gainExp(sharedExpAmount); sharedCount++;
                }
            });
        }
        gameState.currentWildPokemon = null;
        populateRouteSelector(); // Level ups might unlock new routes
        await checkAndTriggerPostBattleEvent(); // Check for event after wild Pokemon faints
    }
}

export function attemptCatch(ballId = 'pokeball') {
    if (gameState.eventModalActive) { addBattleLog("Acknowledge the current event first!"); return; }
    if (!gameState.currentWildPokemon) { addBattleLog("No wild Pokémon to catch!"); return; }

    gameState.battleInProgress = true; updateDisplay();
    gameState.pokeballs[ballId]--;
    const ballUsed = pokeballData[ballId] || pokeballData.pokeball;
    addBattleLog(`Used 1 ${ballUsed.name} on ${gameState.currentWildPokemon.name}...`);
    
    const wildPokemon = gameState.currentWildPokemon;
    let catchChance;

    if (ballId === 'masterball') {
        catchChance = 1.0; // 100% catch rate for Master Ball
    } else {
        const healthMultiplier = Math.pow(1 + (((wildPokemon.maxHp - wildPokemon.currentHp) / wildPokemon.maxHp)), 2.0);
        const levelPenalty = Math.max(0.15, 1 - (wildPokemon.level / 100));
        catchChance = 0.25 * healthMultiplier * levelPenalty * ballUsed.modifier;
        catchChance = Math.max(0.04, Math.min(catchChance, 0.99)); // Cap for non-Master Balls
    }
    
    setTimeout(async () => {
        if (Math.random() < catchChance) {
            const caughtPokemon = new Pokemon(wildPokemon.name, wildPokemon.level, wildPokemon.isShiny, ballId);
            caughtPokemon.currentHp = wildPokemon.currentHp;
            const emptySlot = gameState.party.findIndex(slot => slot === null);
            if (emptySlot !== -1) {
                gameState.party[emptySlot] = caughtPokemon; addBattleLog(`${wildPokemon.name} was added to your party!`);
            } else {
                gameState.allPokemon.push(caughtPokemon); addBattleLog(`${wildPokemon.name} was sent to your PC.`);
            }
            gameState.currentWildPokemon = null;
            populateRouteSelector(); // New Pokemon might change avg level
            await checkAndTriggerPostBattleEvent(); // Check for event after successful catch
        } else {
            addBattleLog(`${wildPokemon.name} broke free!`);
            const playerPokemon = getActivePokemon();
            if (playerPokemon && playerPokemon.currentHp > 0 && wildPokemon.currentHp > 0) {
                addBattleLog(`${wildPokemon.name} attacks!`);
                const wildDamage = calculateDamage(wildPokemon, playerPokemon);
                const playerDefeated = playerPokemon.takeDamage(wildDamage);
                if (wildDamage == 0) {addBattleLog(`${wildPokemon.name} deals no damage to ${playerPokemon.name}!`);}
                else {addBattleLog(`${wildPokemon.name} deals ${wildDamage} damage to ${playerPokemon.name}!`);}
                if (playerDefeated) {
                    // Call handleFaint to manage the player's Pokemon fainting.
                    // This will also handle the "all Pokemon fainted" scenario, including leaving the route.
                    await handleFaint(playerPokemon, wildPokemon, true, routes[gameState.currentRoute]);
                }
            }
        }
        gameState.battleInProgress = false; updateDisplay();
    }, 500);
}

export function toggleAutoFight() {
    if (gameState.eventModalActive) { addBattleLog("Acknowledge the current event before changing auto-fight state."); return; }
    if (!gameState.autoFightUnlocked) { addBattleLog("Auto-Fight is still locked."); return; }

    // If trying to START auto-fight
    if (gameState.autoBattleActive) {
        // Current state is ON, so we are trying to turn it OFF (Stop)
        gameState.autoBattleActive = false;
        addBattleLog("Auto-Fight Stopped!");
        if (autoFightIntervalId) {
            clearInterval(autoFightIntervalId);
            autoFightIntervalId = null;
        }
    } else {
        // Current state is OFF, so we are trying to turn it ON (Start)
        if (gameState.battleInProgress) {
            addBattleLog("Cannot start Auto-Fight during battle.");
            return;
        }
        if (gameState.currentRoute === null) {
            addBattleLog("Cannot start Auto-Fight: No route selected.");
            updateDisplay(); // Ensure button state is correct if it was disabled
            return;
        }

        gameState.autoBattleActive = true;
        addBattleLog("Auto-Fight Started!");
        if (autoFightIntervalId) clearInterval(autoFightIntervalId);
        autoFightIntervalId = setInterval(autoBattleTick, 1000); // Tick every 2 seconds
        autoBattleTick();
    }
    updateDisplay();
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
            if (gameState.currentRoute !== null) leaveCurrentRoute(); else toggleAutoFight();
            return;
        }
    }
    if (!gameState.currentWildPokemon) {
        spawnWildPokemon();
        if (gameState.currentWildPokemon) { addBattleLog(`Auto-Fight: A wild ${gameState.currentWildPokemon.name} appeared!`); updateDisplay(); }
        else { updateDisplay(); return; }
    }
    if (gameState.currentWildPokemon && playerPokemon && playerPokemon.currentHp > 0) await battle();
}

export function addToParty(pokemonIndexInStorage, partySlot) {
    const pokemonToMove = gameState.allPokemon[pokemonIndexInStorage];
    if (gameState.party[partySlot] !== null) {
        if (!gameState.allPokemon.includes(gameState.party[partySlot])) {
             gameState.allPokemon.unshift(gameState.party[partySlot]);
        }
    }
    gameState.party[partySlot] = gameState.allPokemon[pokemonIndexInStorage];
    gameState.allPokemon.splice(pokemonIndexInStorage, 1);
    if (getActivePokemon() === null && pokemonToMove) gameState.activePokemonIndex = partySlot;
    populateRouteSelector(); updateDisplay();
}

export function removeFromParty(partySlot) {
    if (gameState.party[partySlot]) {
        gameState.allPokemon.push(gameState.party[partySlot]);
        gameState.party[partySlot] = null;
        if (gameState.activePokemonIndex === partySlot) {
            const nextHealthy = gameState.party.findIndex(p => p && p.currentHp > 0);
            gameState.activePokemonIndex = nextHealthy !== -1 ? nextHealthy : 0;
        }
        populateRouteSelector(); updateDisplay();
    }
}

export function setActivePokemon(partyIndex) {
    if (gameState.party[partyIndex] && gameState.party[partyIndex].currentHp > 0) {
        gameState.activePokemonIndex = partyIndex;
        updateDisplay(); addBattleLog(`${gameState.party[partyIndex].name} is now active!`);
    }
}

export function attemptEvolution(index, locationType) {
    let pokemonToEvolve = locationType === 'party' ? gameState.party[index] : gameState.allPokemon[index];
    if (pokemonToEvolve && pokemonToEvolve.evolve()) {
        updateDisplay();
        populateRouteSelector(); // Evolution might change average level if it was a party member
    }
}

export function confirmReleasePokemon(storageIndex) {
    const pokemonToRelease = gameState.allPokemon[storageIndex];
    if (!pokemonToRelease) return;
    const totalPokemonCount = gameState.party.filter(p => p !== null).length + gameState.allPokemon.length;
    if (totalPokemonCount <= 1) { alert("You cannot release your last Pokémon!"); return; }
    if (window.confirm(`Release ${pokemonToRelease.name} (Lvl. ${pokemonToRelease.level})? This cannot be undone.`)) {
        releasePokemon(storageIndex);
    }
}

export function releasePokemon(storageIndex) {
    const releasedPokemon = gameState.allPokemon.splice(storageIndex, 1);
    if (releasedPokemon && releasedPokemon.length > 0) {
        addBattleLog(`${releasedPokemon[0].name} has been released.`);
        updateDisplay();
        // saveGame(); // saveGame is called by main loop or manual save
    }
}

export function buyBall(ballId, amount = 1) {
    if (gameState.eventModalActive) { addBattleLog("Acknowledge the current event first!"); return; }
    const ballType = pokeballData[ballId];
    if (!ballType) { addBattleLog("Invalid item."); return; }
    let cost = (ballId === 'pokeball' && amount === 10 && ballType.cost10) ? ballType.cost10 : ballType.cost * amount;
    if (gameState.money >= cost) {
        gameState.money -= cost; gameState.pokeballs[ballId] = (gameState.pokeballs[ballId] || 0) + amount;
        updateDisplay(); addBattleLog(`Bought ${amount} ${ballType.name}${amount > 1 ? 's' : ''} for ${formatNumberWithDots(cost)}₽!`);
    } else { addBattleLog(`Not enough money. Needs ${formatNumberWithDots(cost)}₽.`); }
}

export function buyXpShareUpgrade() {
    if (gameState.eventModalActive) { addBattleLog("Acknowledge the current event first!"); return; }
    if (gameState.xpShareLevel >= XP_SHARE_CONFIG.length) { addBattleLog("XP Share is max level!"); return; }
    const nextLevelConfig = XP_SHARE_CONFIG[gameState.xpShareLevel];
    if (gameState.money >= nextLevelConfig.cost) {
        gameState.money -= nextLevelConfig.cost; gameState.xpShareLevel++;
        addBattleLog(`Purchased ${nextLevelConfig.name} for ${formatNumberWithDots(nextLevelConfig.cost)}₽!`);
        updateDisplay();
    } else { addBattleLog(`Not enough money. Needs ${formatNumberWithDots(nextLevelConfig.cost)}₽.`); }
}

export function buyItem(itemId, quantity = 1) { // Renamed from buyPotion, potionId to itemId
    if (gameState.eventModalActive) { addBattleLog("Acknowledge the current event first!"); return; }
    const itemInfo = itemData[itemId]; // Renamed from potionData, potionInfo to itemInfo
    if (!itemInfo) { addBattleLog("Invalid item."); return; }
    const cost = itemInfo.cost * quantity;
    if (gameState.money >= cost) {
        gameState.money -= cost; gameState.items[itemId] = (gameState.items[itemId] || 0) + quantity; // Renamed from gameState.potions
        updateDisplay(); addBattleLog(`Bought ${quantity} ${itemInfo.name}${quantity > 1 ? 's' : ''} for ${formatNumberWithDots(cost)}₽!`);
    } else { addBattleLog(`Not enough money. Needs ${formatNumberWithDots(cost)}₽.`); }
}

export function useItem(itemId) { // Renamed from usePotion, potionId to itemId
    if (gameState.eventModalActive) { addBattleLog("Acknowledge the current event first!"); return; }
    const itemInfo = itemData[itemId]; // Renamed from potionData, potionInfo to itemInfo
    if (!itemInfo || !gameState.items[itemId] || gameState.items[itemId] <= 0) { // Renamed from gameState.potions
        addBattleLog(`No ${itemInfo ? itemInfo.name : 'items'} left or invalid type!`); return;
    }
    let healedSomething = false; const activePokemon = getActivePokemon();
    let logged = false;
    if (itemInfo.effectType === 'active_pokemon_percentage' && activePokemon) {
        if (activePokemon.currentHp < activePokemon.maxHp) { // Allow healing/reviving if not full HP
            activePokemon.healPartial(itemInfo.effectValue); healedSomething = true;
        }
    } else if (itemInfo.effectType === 'active_pokemon_full' && activePokemon) {
        if (activePokemon.currentHp < activePokemon.maxHp) { // Allow healing/reviving if not full HP
            activePokemon.heal(); healedSomething = true;
        }
    } else if (itemInfo.effectType === 'party_full') {
        gameState.party.forEach(p => { if (p && p.currentHp < p.maxHp) { p.heal(); healedSomething = true; }}); // Allow healing/reviving if not full HP
    }
    // Handle Evolution Items
    else if (itemInfo.effectType === 'evolution_item' && activePokemon) {
        const evolutionDefinition = itemInfo.evolutionTargets?.find(target => target.pokemon === activePokemon.name);

        if (evolutionDefinition && pokemonBaseStatsData[evolutionDefinition.evolvesTo]) {
            const originalPokemonNameForLog = activePokemon.name;
            const targetEvolutionName = evolutionDefinition.evolvesTo;
            const preservedLevel = activePokemon.level;
            const preservedShiny = activePokemon.isShiny;
            const preservedBall = activePokemon.caughtWithBall;

            // Update the active Pokemon instance in place
            activePokemon.name = targetEvolutionName; // Set name first, so constructor uses it for stats
            Object.assign(activePokemon, new Pokemon(activePokemon.name, preservedLevel, preservedShiny, preservedBall));
            // The ID will change due to `new Pokemon`, which is consistent with existing level-up evolution.
            activePokemon.heal(); // Fully heal on evolution
            activePokemon.exp = 0;  // Reset EXP

            addBattleLog(`Your ${originalPokemonNameForLog} used the ${itemInfo.name} and evolved into ${activePokemon.name}!`);
            healedSomething = true; // To consume the item
            populateRouteSelector(); // Evolution might change average level if it was a party member
        } 
        else {
            addBattleLog(`${itemInfo.name} had no effect on ${activePokemon.name}.`);
            logged = true
        }
    }
    // Handle Rare Candy
    else if (itemInfo.effectType === 'level_up' && activePokemon) {
        if (activePokemon.level < 100) {
            activePokemon.gainLevels(itemInfo.effectValue || 1); // Use effectValue or default to 1 level
            healedSomething = true; // To consume the item
        } else {
            addBattleLog(`${activePokemon.name} is already at the maximum level!`);
            logged = true;
        }
    }
    if (healedSomething) {
        gameState.items[itemId]--; addBattleLog(`Used ${itemInfo.name}!`); // Renamed from gameState.potions
    } else if (!logged) { addBattleLog(`${itemInfo.name} had no effect.`); }
    updateDisplay();
}

export function freeFullHeal() {
    if (gameState.eventModalActive) { addBattleLog("Acknowledge the current event first!"); return; }
    const hasNoMoomooMilk = (gameState.items.moomoomilk || 0) === 0; // Renamed from gameState.potions
    const hasNoHyperPotion = (gameState.items.hyperpotion || 0) === 0; // Renamed from gameState.potions

    if (gameState.money < 800 && (hasNoMoomooMilk || hasNoHyperPotion)) {
        let healedCount = 0;
        gameState.party.forEach(pokemon => {
            if (pokemon && pokemon.currentHp < pokemon.maxHp) {
                pokemon.heal();
                healedCount++;
            }
        });
        if (healedCount > 0) {
            addBattleLog("Your party has been fully healed for free!");
        } else {
            addBattleLog("Your party is already healthy!");
        }
        updateDisplay();
    } else {
        addBattleLog("Conditions for free heal not met."); // Should not happen if button is hidden
    }
}

export function cheatAddPokemon(pokemonName, level = 5, isShiny = false) {
    if (!pokemonBaseStatsData[pokemonName]) {
        const errorMessage = `Cheat Error: Pokémon "${pokemonName}" not found in game data. Check spelling and capitalization.`;
        console.error(errorMessage);
        addBattleLog(errorMessage);
        return;
    }

    const newPokemon = new Pokemon(pokemonName, parseInt(level, 10) || 5, !!isShiny); // Ensure level is int, shiny is bool
    const emptyPartySlot = gameState.party.findIndex(slot => slot === null);

    if (emptyPartySlot !== -1) {
        gameState.party[emptyPartySlot] = newPokemon;
        addBattleLog(`Cheated ${newPokemon.isShiny ? 'Shiny ' : ''}${newPokemon.name} (Lvl. ${newPokemon.level}) into party!`);
        if (getActivePokemon() === null) { // If no active Pokemon, make this the active one
            gameState.activePokemonIndex = emptyPartySlot;
        }
    } else {
        gameState.allPokemon.push(newPokemon);
        addBattleLog(`Cheated ${newPokemon.isShiny ? 'Shiny ' : ''}${newPokemon.name} (Lvl. ${newPokemon.level}) into PC!`);
    }

    updateDisplay();
    populateRouteSelector(); // In case average party level changes
    console.log(`Successfully added ${newPokemon.name} (Lvl ${newPokemon.level}, Shiny: ${newPokemon.isShiny}) to the game.`);
}

export function cheatAddMoney(amount) {
    const moneyToAdd = parseInt(amount, 10);
    if (isNaN(moneyToAdd) || moneyToAdd <= 0) {
        const errorMessage = `Cheat Error: Invalid amount "${amount}". Please provide a positive number.`;
        console.error(errorMessage);
        addBattleLog(errorMessage);
        return;
    }
    gameState.money += moneyToAdd;
    addBattleLog(`Cheated ${formatNumberWithDots(moneyToAdd)}₽! Current money: ${formatNumberWithDots(gameState.money)}₽.`);
    updateDisplay(); // Ensure the UI reflects the new money amount
    console.log(`Successfully added ${moneyToAdd}₽. Current money: ${gameState.money}`);
}

export function cheatAddItem(itemId, quantity = 1) {
    const numQuantity = parseInt(quantity, 10);

    if (typeof itemId !== 'string' || itemId.trim() === '') {
        const errorMessage = `Cheat Error: Invalid item ID. Please provide a valid string ID.`;
        console.error(errorMessage);
        addBattleLog(errorMessage);
        return;
    }
    if (isNaN(numQuantity) || numQuantity <= 0) {
        const errorMessage = `Cheat Error: Invalid quantity "${quantity}". Please provide a positive number.`;
        console.error(errorMessage);
        addBattleLog(errorMessage);
        return;
    }

    let itemNameForLog = itemId;
    if (pokeballData[itemId]) {
        gameState.pokeballs[itemId] = (gameState.pokeballs[itemId] || 0) + numQuantity;
        itemNameForLog = pokeballData[itemId].name;
    } else if (itemData[itemId]) {
        gameState.items[itemId] = (gameState.items[itemId] || 0) + numQuantity;
        itemNameForLog = itemData[itemId].name;
    } else {
        addBattleLog(`Cheat Error: Item ID "${itemId}" not found in pokeballData or itemData.`);
        return;
    }
    addBattleLog(`Cheated ${numQuantity}x ${itemNameForLog}!`);
    updateDisplay();
}
// --- Post-Battle Event Logic ---
async function checkAndTriggerPostBattleEvent() {
    if (gameState.eventModalActive) return; // Don't trigger if one is already active

    if (Math.random() < eventDefinitions.globalEventChance) {
        const availableEvents = eventDefinitions.events;
        if (availableEvents.length === 0) return;

        const totalWeight = availableEvents.reduce((sum, event) => sum + event.weight, 0);
        let randomRoll = Math.random() * totalWeight;
        let selectedEvent;

        for (const event of availableEvents) {
            if (randomRoll < event.weight) {
                selectedEvent = event;
                break;
            }
            randomRoll -= event.weight;
        }

        if (selectedEvent) {
            await triggerPostBattleEvent(selectedEvent);
        }
    }
}

async function triggerPostBattleEvent(eventData) {
    gameState.eventModalActive = true;
    let processedEventData = { ...eventData }; // Clone to avoid modifying original definitions

    // Pre-calculate quantity for display if it's a range
    if (eventData.type === "give_item" && Array.isArray(eventData.quantity)) {
        processedEventData.resolvedQuantity = Math.floor(Math.random() * (eventData.quantity[1] - eventData.quantity[0] + 1)) + eventData.quantity[0];
    } else if (eventData.type === "give_item") {
        processedEventData.resolvedQuantity = eventData.quantity;
    }

    gameState.currentPostBattleEvent = processedEventData;
    showEventModal(processedEventData); // UI function

    if (gameState.autoBattleActive) {
        if (gameState.eventModalTimerId) clearTimeout(gameState.eventModalTimerId);
        gameState.eventModalTimerId = setTimeout(resolvePostBattleEvent, 5000); // 5 seconds
    }
}

export async function resolvePostBattleEvent() {
    if (!gameState.eventModalActive || !gameState.currentPostBattleEvent) return;

    if (gameState.eventModalTimerId) {
        clearTimeout(gameState.eventModalTimerId);
        gameState.eventModalTimerId = null;
    }

    const event = gameState.currentPostBattleEvent;
    let outcomeMessage = event.message || event.description; // Default to description if no specific message

    if (event.type === "heal_party") {
        gameState.party.forEach(p => { if (p) p.heal(); });
        // Message is usually defined in events.json
    } else if (event.type === "give_item") {
        const quantity = event.resolvedQuantity || (Array.isArray(event.quantity) ? (Math.floor(Math.random() * (event.quantity[1] - event.quantity[0] + 1)) + event.quantity[0]) : event.quantity);
        const itemKey = event.item.toLowerCase(); // Ensure consistent key

        if (pokeballData[itemKey]) { // It's a Pokéball
            gameState.pokeballs[itemKey] = (gameState.pokeballs[itemKey] || 0) + quantity;
        } else { // It's a regular item
            gameState.items[itemKey] = (gameState.items[itemKey] || 0) + quantity;
        }
        outcomeMessage = outcomeMessage.replace("{quantity}", quantity);
    }

    addBattleLog(outcomeMessage);
    gameState.eventModalActive = false;
    gameState.currentPostBattleEvent = null;
    closeEventModal(); // UI function
    updateDisplay();
}