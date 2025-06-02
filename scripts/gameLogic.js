// gameLogic.js
import { gameState, routes, pokeballData, potionData, pokemonBaseStatsData } from './state.js';
import { Pokemon } from './pokemon.js';
import { addBattleLog, getActivePokemon, findNextHealthyPokemon, formatNumberWithDots } from './utils.js';
import { updateDisplay, updateWildPokemonDisplay, populateRouteSelector } from './ui.js';
import { AUTO_FIGHT_UNLOCK_WINS, XP_SHARE_CONFIG } from './config.js';

let autoFightIntervalId = null;

export async function manualBattle() {
    if (gameState.battleInProgress || gameState.autoBattleActive) {
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
    let playerPokemon = getActivePokemon();
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
        addBattleLog("No wild Pokemon to battle!");
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

    const damageByFirst = calculateDamage(firstAttacker, secondAttacker);
    const secondAttackerFainted = secondAttacker.takeDamage(damageByFirst);
    addBattleLog(`${firstAttacker.name} deals ${damageByFirst} damage to ${secondAttacker.name}!`);
    updateDisplay();

    if (secondAttackerFainted) {
        await handleFaint(secondAttacker, firstAttacker, !firstIsPlayer, currentRouteData);
        gameState.battleInProgress = false;
        if (!firstIsPlayer && (!getActivePokemon() || getActivePokemon().currentHp <= 0)) { // Player's Pokemon fainted and no healthy ones left
            if (gameState.currentRoute !== null) leaveCurrentRoute();
        }
        updateDisplay();
        return;
    }

    if (secondAttacker.currentHp > 0 && firstAttacker.currentHp > 0) {
        addBattleLog(`${secondAttacker.name} attacks!`);
        await new Promise(resolve => setTimeout(resolve, 300));
        const damageBySecond = calculateDamage(secondAttacker, firstAttacker);
        const firstAttackerFainted = firstAttacker.takeDamage(damageBySecond);
        addBattleLog(`${secondAttacker.name} deals ${damageBySecond} damage to ${firstAttacker.name}!`);
        updateDisplay();

        if (firstAttackerFainted) {
            await handleFaint(firstAttacker, secondAttacker, firstIsPlayer, currentRouteData);
            if (firstIsPlayer && (!getActivePokemon() || getActivePokemon().currentHp <= 0)) { // Player's Pokemon fainted and no healthy ones left
                if (gameState.currentRoute !== null) leaveCurrentRoute();
            }
        }
    }
    gameState.battleInProgress = false;
    updateDisplay();
}

export function calculateDamage(attacker, _defender) {
    let baseMultiplier = (getActivePokemon() && attacker.id === getActivePokemon().id) ? 0.3 : 0.2;
    let randomMultiplier = (getActivePokemon() && attacker.id === getActivePokemon().id) ? 0.5 : 0.4;
    return Math.floor(Math.random() * attacker.attack * randomMultiplier) + Math.floor(attacker.attack * baseMultiplier);
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
            if (gameState.autoBattleActive) toggleAutoFight();
        }
    } else {
        const baseExp = faintedPokemon.level * 20;
        const levelDifference = faintedPokemon.level - victorPokemon.level; // Positive if wild is higher, negative if player is higher

        // XP Multiplier:
        // - Increases by 10% for each level the wild Pokemon is higher.
        // - Decreases by 10% for each level the player's Pokemon is higher.
        // - Capped between 0.1x (10%) and 2.0x (250%)
        let xpMultiplier = 1 + (levelDifference * 0.10);
        xpMultiplier = Math.max(0.1, Math.min(xpMultiplier, 2.5));
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
            const sharedExpAmount = Math.floor(expGained * currentXpShare.percentage);
            if (sharedExpAmount > 0) {
                let sharedCount = 0;
                gameState.party.forEach(p => {
                    if (p && p.id !== victorPokemon.id && p.currentHp > 0) {
                        p.gainExp(sharedExpAmount); sharedCount++;
                    }
                });
                if (sharedCount > 0) addBattleLog(`XP Share distributed ${sharedExpAmount} EXP to ${sharedCount} other Pokémon!`);
            }
        }
        gameState.currentWildPokemon = null;
        populateRouteSelector(); // Level ups might unlock new routes
    }
}

export function attemptCatch(ballId = 'pokeball') {
    if (!gameState.currentWildPokemon) { addBattleLog("No wild Pokemon to catch!"); return; }

    gameState.battleInProgress = true; updateDisplay();
    gameState.pokeballs[ballId]--;
    const ballUsed = pokeballData[ballId] || pokeballData.pokeball;
    addBattleLog(`Used 1 ${ballUsed.name} on ${gameState.currentWildPokemon.name}...`);
    
    const wildPokemon = gameState.currentWildPokemon;
    const healthMultiplier = 1 + (((wildPokemon.maxHp - wildPokemon.currentHp) / wildPokemon.maxHp) * 1.5);
    const levelPenalty = Math.max(0.2, 1 - (wildPokemon.level / 75));
    let catchChance = 0.25 * healthMultiplier * levelPenalty * ballUsed.modifier;
    catchChance = Math.max(0.05, Math.min(catchChance, 0.95));
    addBattleLog(`Calculated catch chance: ${(catchChance * 100).toFixed(1)}%`);

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
        } else {
            addBattleLog(`${wildPokemon.name} broke free!`);
            const playerPokemon = getActivePokemon();
            if (playerPokemon && playerPokemon.currentHp > 0 && wildPokemon.currentHp > 0) {
                addBattleLog(`${wildPokemon.name} attacks!`);
                const wildDamage = calculateDamage(wildPokemon, playerPokemon);
                const playerDefeated = playerPokemon.takeDamage(wildDamage);
                addBattleLog(`${wildPokemon.name} deals ${wildDamage} damage to ${playerPokemon.name}!`);
                if (playerDefeated) {
                    updateDisplay(); await new Promise(resolve => setTimeout(resolve, 1200));
                    addBattleLog(`${playerPokemon.name} fainted!`);
                    const nextPokemon = findNextHealthyPokemon();
                    if (nextPokemon) { gameState.activePokemonIndex = gameState.party.indexOf(nextPokemon); addBattleLog(`Go, ${nextPokemon.name}!`); }
                }
            }
        }
        gameState.battleInProgress = false; updateDisplay();
    }, 500);
}

export function toggleAutoFight() {
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
    if (!gameState.autoBattleActive || gameState.battleInProgress || gameState.currentRoute === null) return;
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
    const ballType = pokeballData[ballId];
    if (!ballType) { addBattleLog("Invalid item."); return; }
    let cost = (ballId === 'pokeball' && amount === 10 && ballType.cost10) ? ballType.cost10 : ballType.cost * amount;
    if (gameState.money >= cost) {
        gameState.money -= cost; gameState.pokeballs[ballId] = (gameState.pokeballs[ballId] || 0) + amount;
        updateDisplay(); addBattleLog(`Bought ${amount} ${ballType.name}${amount > 1 ? 's' : ''} for ${formatNumberWithDots(cost)}₽!`);
    } else { addBattleLog(`Not enough money. Needs ${formatNumberWithDots(cost)}₽.`); }
}

export function buyXpShareUpgrade() {
    if (gameState.xpShareLevel >= XP_SHARE_CONFIG.length) { addBattleLog("XP Share is max level!"); return; }
    const nextLevelConfig = XP_SHARE_CONFIG[gameState.xpShareLevel];
    if (gameState.money >= nextLevelConfig.cost) {
        gameState.money -= nextLevelConfig.cost; gameState.xpShareLevel++;
        addBattleLog(`Purchased ${nextLevelConfig.name} for ${formatNumberWithDots(nextLevelConfig.cost)}₽!`);
        updateDisplay();
    } else { addBattleLog(`Not enough money. Needs ${formatNumberWithDots(nextLevelConfig.cost)}₽.`); }
}

export function buyPotion(potionId, quantity = 1) {
    const potionInfo = potionData[potionId];
    if (!potionInfo) { addBattleLog("Invalid item."); return; }
    const cost = potionInfo.cost * quantity;
    if (gameState.money >= cost) {
        gameState.money -= cost; gameState.potions[potionId] = (gameState.potions[potionId] || 0) + quantity;
        updateDisplay(); addBattleLog(`Bought ${quantity} ${potionInfo.name}${quantity > 1 ? 's' : ''} for ${formatNumberWithDots(cost)}₽!`);
    } else { addBattleLog(`Not enough money. Needs ${formatNumberWithDots(cost)}₽.`); }
}

export function usePotion(potionId) {
    const potionInfo = potionData[potionId];
    if (!potionInfo || !gameState.potions[potionId] || gameState.potions[potionId] <= 0) {
        addBattleLog(`No ${potionInfo ? potionInfo.name : 'potions'} left or invalid type!`); return;
    }
    let healedSomething = false; const activePokemon = getActivePokemon();
    if (potionInfo.effectType === 'active_pokemon_percentage' && activePokemon) {
        if (activePokemon.currentHp > 0 && activePokemon.currentHp < activePokemon.maxHp) {
            activePokemon.healPartial(potionInfo.effectValue); healedSomething = true;
        }
    } else if (potionInfo.effectType === 'active_pokemon_full' && activePokemon) {
        if (activePokemon.currentHp > 0 && activePokemon.currentHp < activePokemon.maxHp) {
            activePokemon.heal(); healedSomething = true;
        }
    } else if (potionInfo.effectType === 'party_full') {
        gameState.party.forEach(p => { if (p && p.currentHp > 0 && p.currentHp < p.maxHp) { p.heal(); healedSomething = true; }});
    }
    if (healedSomething) {
        gameState.potions[potionId]--; addBattleLog(`Used ${potionInfo.name}!`);
    } else { addBattleLog(`${potionInfo.name} had no effect.`); }
    updateDisplay();
}

export function freeFullHeal() {
    const hasNoMoomooMilk = (gameState.potions.moomoomilk || 0) === 0;
    const hasNoHyperPotion = (gameState.potions.hyperpotion || 0) === 0;

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