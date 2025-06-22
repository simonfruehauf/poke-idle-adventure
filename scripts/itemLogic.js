// scripts/itemLogic.js
import { gameState, pokeballData, itemData, pokemonBaseStatsData } from './state.js';
import { addBattleLog, getActivePokemon, formatNumberWithDots } from './utils.js';
import { updateDisplay, populateRouteSelector } from './ui.js';
import { XP_SHARE_CONFIG } from './config.js';
// Pokemon class might be needed if using an item causes evolution directly here.
// For now, assuming evolution attempt is handled by partyLogic or similar.
// import { Pokemon } from './pokemon.js';


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

export async function buyItem(itemId, quantity = 1) {
    if (gameState.eventModalActive) { addBattleLog("Acknowledge the current event first!"); return; }
    const itemInfo = itemData[itemId];
    if (!itemInfo) { addBattleLog("Invalid item."); return; }
    const cost = itemInfo.cost * quantity;
    if (gameState.money >= cost) {
        gameState.money -= cost; gameState.items[itemId] = (gameState.items[itemId] || 0) + quantity;
        updateDisplay(); addBattleLog(`Bought ${quantity} ${itemInfo.name}${quantity > 1 ? 's' : ''} for ${formatNumberWithDots(cost)}₽!`);
    } else { addBattleLog(`Not enough money. Needs ${formatNumberWithDots(cost)}₽.`); }
}

export async function useItem(itemId) {
    if (gameState.eventModalActive) { addBattleLog("Acknowledge the current event first!"); return; }
    const itemInfo = itemData[itemId];
    if (!itemInfo || !gameState.items[itemId] || gameState.items[itemId] <= 0) {
        addBattleLog(`No ${itemInfo ? itemInfo.name : 'items'} left or invalid type!`); return;
    }
    let itemUsedSuccessfully = false;
    const activePokemon = getActivePokemon();
    let loggedCustomMessage = false;

    if (itemInfo.effectType === 'active_pokemon_percentage' && activePokemon) {
        if (activePokemon.currentHp < activePokemon.maxHp) {
            activePokemon.healPartial(itemInfo.effectValue); itemUsedSuccessfully = true;
        }
    } else if (itemInfo.effectType === 'active_pokemon_full' && activePokemon) {
        if (activePokemon.currentHp < activePokemon.maxHp) {
            activePokemon.heal(); itemUsedSuccessfully = true;
        }
    } else if (itemInfo.effectType === 'party_full') {
        let anyHealed = false;
        gameState.party.forEach(p => {
            if (p && p.currentHp < p.maxHp) {
                p.heal();
                anyHealed = true;
            }
        });
        if (anyHealed) itemUsedSuccessfully = true;
    } else if (itemInfo.effectType === 'evolution_item' && activePokemon) {
        const evolutionDefinition = itemInfo.evolutionTargets?.find(target => target.pokemon === activePokemon.name);
        if (evolutionDefinition && pokemonBaseStatsData[evolutionDefinition.evolvesTo]) {
            const originalPokemonNameForLog = activePokemon.name; // Use species name for log clarity
            // attemptEvolution needs to be imported or this logic moved.
            // For now, assuming a direct call to activePokemon.evolve(target)
            if (await activePokemon.evolve(evolutionDefinition.evolvesTo)) {
                addBattleLog(`Your ${originalPokemonNameForLog} used the ${itemInfo.name} and evolved into ${activePokemon.name}!`);
                itemUsedSuccessfully = true;
                populateRouteSelector();
            } else {
                // This 'else' might be complex: evolve could fail if conditions aren't met beyond just item.
                // Pokemon.evolve should ideally handle its own specific failure messages.
                addBattleLog(`${itemInfo.name} had no effect on ${activePokemon.name}. (Evolution criteria not fully met or already evolved)`);
                loggedCustomMessage = true;
            }
        } else {
             addBattleLog(`${itemInfo.name} cannot be used on ${activePokemon.name} or target evolution data is missing.`);
             loggedCustomMessage = true;
        }
    } else if (itemInfo.effectType === 'level_up' && activePokemon) {
        if (activePokemon.level < 100) {
            activePokemon.gainLevels(itemInfo.effectValue || 1);
            itemUsedSuccessfully = true;
        } else {
            addBattleLog(`${activePokemon.name} is already at the maximum level!`);
            loggedCustomMessage = true;
        }
    }

    if (itemUsedSuccessfully) {
        gameState.items[itemId]--;
        addBattleLog(`Used ${itemInfo.name}!`);
    } else if (!loggedCustomMessage) { // Avoid double logging if a specific message was already shown
        addBattleLog(`${itemInfo.name} had no effect.`);
    }
    updateDisplay();
}

export function freeFullHeal() {
    if (gameState.eventModalActive) { addBattleLog("Acknowledge the current event first!"); return; }
    const hasNoMoomooMilk = (gameState.items.moomoomilk || 0) === 0;
    const hasNoHyperPotion = (gameState.items.hyperpotion || 0) === 0;

    // Condition for free heal button visibility should match this logic
    if (gameState.money < 800 && (hasNoMoomooMilk && hasNoHyperPotion)) {
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
        // This message should ideally not be reachable if button visibility is correct
        addBattleLog("Conditions for free heal not met (Button should be hidden).");
    }
}
