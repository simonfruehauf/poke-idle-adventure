// gameLogic.js
// This file now primarily coordinates logic from other modules and handles game-wide state or cross-cutting concerns.

import { gameState, routes, pokeballData, itemData, pokemonBaseStatsData, eventDefinitions } from './state.js';
import { Pokemon } from './pokemon.js';
import { addBattleLog, getActivePokemon, findNextHealthyPokemon, formatNumberWithDots } from './utils.js';
import { updateDisplay, populateRouteSelector, showEventModal, closeEventModal } from './ui.js'; // Removed displayPokemonData as it's UI internal
import { AUTO_FIGHT_UNLOCK_WINS } from './config.js'; // XP_SHARE_CONFIG, etc. are used in their specific modules
import { handleIncubatorClick, handleEggClick } from './eggFeatures.js';
import { fetchPokemonDataFromAPI } from './apiService.js';

// Import functions from new logic modules
import * as battleLogic from './battleLogic.js';
import * as routeLogic from './routeLogic.js';
import * as itemLogic from './itemLogic.js';
import * as partyLogic from './partyLogic.js';


let autoFightIntervalId = null;

// --- Auto-Fight ---
export async function toggleAutoFight() { // Now async due to autoBattleTick being async
    if (gameState.eventModalActive) { addBattleLog("Acknowledge the current event before changing auto-fight state."); return; }
    if (!gameState.autoFightUnlocked) { addBattleLog("Auto-Fight is still locked."); return; }

    if (gameState.autoBattleActive) {
        gameState.autoBattleActive = false;
        addBattleLog("Auto-Fight Stopped!");
        if (autoFightIntervalId) {
            clearInterval(autoFightIntervalId);
            autoFightIntervalId = null;
        }
    } else {
        if (gameState.battleInProgress) { addBattleLog("Cannot start Auto-Fight during battle."); return; }
        if (gameState.currentRoute === null) { addBattleLog("Cannot start Auto-Fight: No route selected."); updateDisplay(); return; }

        gameState.autoBattleActive = true;
        addBattleLog("Auto-Fight Started!");
        if (autoFightIntervalId) clearInterval(autoFightIntervalId);
        // Call immediately, then set interval
        await battleLogic.autoBattleTick(); // Make sure to await the first tick
        autoFightIntervalId = setInterval(battleLogic.autoBattleTick, 1000); // Tick every 1 second
    }
    updateDisplay();
}


// --- Party Level Calculation (Used by UI for route selector) ---
// These might be better in a `partyUtils.js` or kept here if they inform general game logic beyond just party.
// For now, keeping them here as they are used by `populateRouteSelector` which is often called from gameLogic.
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


// --- Post-Battle Event Logic ---
// This is intrinsically linked to battle outcomes, so it makes sense to keep it coordinated here,
// or potentially move it into battleLogic if it's solely triggered from there.
// For now, `checkAndTriggerPostBattleEvent` is called from `battleLogic.handleFaint` and `battleLogic.attemptCatch`.
export async function checkAndTriggerPostBattleEvent() {
    if (gameState.eventModalActive) return;

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
    let processedEventData = { ...eventData };

    if (eventData.type === "give_item" && Array.isArray(eventData.quantity)) {
        processedEventData.resolvedQuantity = Math.floor(Math.random() * (eventData.quantity[1] - eventData.quantity[0] + 1)) + eventData.quantity[0];
    } else if (eventData.type === "give_item") {
        processedEventData.resolvedQuantity = eventData.quantity;
    }

    gameState.currentPostBattleEvent = processedEventData;
    showEventModal(processedEventData);

    if (gameState.autoBattleActive) {
        if (gameState.eventModalTimerId) clearTimeout(gameState.eventModalTimerId);
        gameState.eventModalTimerId = setTimeout(resolvePostBattleEvent, 5000);
    }
}

export async function resolvePostBattleEvent() {
    if (!gameState.eventModalActive || !gameState.currentPostBattleEvent) return;

    if (gameState.eventModalTimerId) {
        clearTimeout(gameState.eventModalTimerId);
        gameState.eventModalTimerId = null;
    }

    const event = gameState.currentPostBattleEvent;
    let outcomeMessage = event.message || event.description;

    if (event.type === "heal_party") {
        gameState.party.forEach(p => { if (p) p.heal(); });
    } else if (event.type === "give_item") {
        const quantity = event.resolvedQuantity; // Already resolved in triggerPostBattleEvent
        const itemKey = event.item.toLowerCase();

        if (pokeballData[itemKey]) {
            gameState.pokeballs[itemKey] = (gameState.pokeballs[itemKey] || 0) + quantity;
        } else {
            gameState.items[itemKey] = (gameState.items[itemKey] || 0) + quantity;
        }
        outcomeMessage = outcomeMessage.replace("{quantity}", quantity.toString());
    }

    addBattleLog(outcomeMessage);
    gameState.eventModalActive = false;
    gameState.currentPostBattleEvent = null;
    closeEventModal();
    updateDisplay();
}


// --- Cheat Codes ---
// Kept in gameLogic.js as they are general purpose dev tools.
export function cheatHatchEgg(type = 'mystery', override = false) {
    // Directly call eggFeatures logic, as cheats bypass normal game flow.
    handleIncubatorClick(type, override);
}
export function cheatCreateEgg(override = false) {
    handleEggClick(override);
}

export async function cheatAddPokemon(pokemonName, level = 5, isShiny = false) {
    const formattedPokemonName = pokemonName.charAt(0).toUpperCase() + pokemonName.slice(1).toLowerCase();
    const pokemonData = await fetchPokemonDataFromAPI(formattedPokemonName);

    if (!pokemonData) { return; } // fetchPokemonDataFromAPI handles logging

    const newPokemon = await Pokemon.create(formattedPokemonName, parseInt(level, 10) || 5, !!isShiny);
    const emptyPartySlot = gameState.party.findIndex(slot => slot === null);

    if (emptyPartySlot !== -1) {
        gameState.party[emptyPartySlot] = newPokemon;
        addBattleLog(`Cheated ${newPokemon.isShiny ? 'Shiny ' : ''}${newPokemon.name} (Lvl. ${newPokemon.level}) into party!`);
        if (getActivePokemon() === null) { gameState.activePokemonIndex = emptyPartySlot; }
    } else {
        gameState.allPokemon.push(newPokemon);
        addBattleLog(`Cheated ${newPokemon.isShiny ? 'Shiny ' : ''}${newPokemon.name} (Lvl. ${newPokemon.level}) into PC!`);
    }
    updateDisplay();
    populateRouteSelector();
}

export function cheatAddMoney(amount) {
    const moneyToAdd = parseInt(amount, 10);
    if (isNaN(moneyToAdd) || moneyToAdd <= 0) { /* ... error handling ... */ return; }
    gameState.money += moneyToAdd;
    addBattleLog(`Cheated ${formatNumberWithDots(moneyToAdd)}₽!`);
    updateDisplay();
}

export function cheatAddItem(itemId, quantity = 1) {
    let numQuantity = parseInt(quantity, 10);
    if (typeof itemId !== 'string' || /* ... error handling ... */ isNaN(numQuantity) || numQuantity <= 0) { return; }

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

export function changePokemonNickname(index, locationType, newNicknameStr) {
    let pokemonToNickname;
    if (locationType === 'party') {
        pokemonToNickname = gameState.party[index];
    } else if (locationType === 'storage') {
        pokemonToNickname = gameState.allPokemon[index];
    }

    if (!pokemonToNickname) {
        addBattleLog("Error: Could not find Pokémon to nickname.");
        console.error(`Pokemon not found at index ${index} in ${locationType}`);
        return;
    }

    const oldNickname = pokemonToNickname.nickname;
    const speciesName = pokemonToNickname.name;
    const intendedNickname = newNicknameStr ? newNicknameStr.trim() : ""; // What the user typed, trimmed

    // Call the Pokemon's setNickname method, which handles validation and truncation/reset
    const actualNewNickname = pokemonToNickname.setNickname(newNicknameStr);

    // Log the outcome
    if (oldNickname === actualNewNickname) {
        if (intendedNickname.length > 12 && oldNickname.length === 12 && intendedNickname.substring(0,12) === oldNickname) {
            addBattleLog(`Nickname for ${oldNickname} was too long. It remains ${actualNewNickname} as it was already the truncated version.`);
        } else if (intendedNickname === "" && oldNickname === speciesName) {
             addBattleLog(`${oldNickname}'s nickname is already its species name.`);
        } else {
            addBattleLog(`${oldNickname}'s nickname remains unchanged.`);
        }
    } else if (actualNewNickname === speciesName) { // Nickname was reset
        addBattleLog(`${oldNickname}'s nickname was reset to ${speciesName}.`);
    } else if (intendedNickname.length > 12) { // Nickname was truncated
        addBattleLog(`${oldNickname}'s nickname was too long and has been set to ${actualNewNickname}.`);
    } else { // Standard change
        addBattleLog(`${oldNickname}'s nickname changed to ${actualNewNickname}.`);
    }

    updateDisplay();
    // saveGame(); // Consider if explicit save is needed here or rely on auto-save
}