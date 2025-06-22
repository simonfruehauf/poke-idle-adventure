// scripts/ui.js
// Main UI coordinator. Imports specific UI modules and orchestrates updates.

import { gameState, routes, pokeballData, itemData } from './state.js';
import { getActivePokemon, formatNumberWithDots } from './utils.js';
import { AUTO_FIGHT_UNLOCK_WINS } from './config.js'; // Other configs like STARTER_POKEMON_NAMES used in modalDisplay
import { updateIncubatorUI, updateEggUI } from './eggFeatures.js';

// Import UI modules
import * as pokeDisplay from './ui/pokemonDisplay.js';
import * as partyDisplay from './ui/partyDisplay.js';
import * as storageDisplay from './ui/storageDisplay.js';
import * as shopDisplay from './ui/shopDisplay.js';
import * // All modal functions are now distinct exports
    from './ui/modalDisplay.js';

// Import necessary game logic functions for UI interactions that trigger logic
// These are placeholders; actual imports will come from the new logic modules via main.js or direct
import {
    changePokemonNickname,
    confirmReleasePokemon as confirmReleasePokemonLogic,
    addToParty as addToPartyLogic,
    setActivePokemon as setActivePokemonLogic,
    removeFromParty as removeFromPartyLogic,
    attemptEvolution as attemptEvolutionLogic
} from './partyLogic.js'; // Assuming these are the final locations
import { calculateMinPartyLevel } from './gameLogic.js'; // Or from a more specific module if moved


// --- Main Update Function ---
export function updateDisplay() {
    _updatePlayerStatsDisplay();
    _updateMainActionButtonsState();
    shopDisplay.updateShopInterface();
    _updateItemBarTooltips(); // This might need to be part of itemBarDisplay module if created

    updateIncubatorUI(); // From eggFeatures.js
    updateEggUI();       // From eggFeatures.js

    // Update Player and Wild Pokémon Battle Displays
    const playerElements = {
        nameEl: document.getElementById('player-name'),
        levelEl: document.getElementById('player-level'),
        spriteEl: document.getElementById('player-sprite'),
        hpTextEl: document.getElementById('player-hp-text'),
        hpBarId: 'player-hp', // This is the ID of the FILLER div for the bar
        statsEl: document.getElementById('player-stats'),
        defaultName: 'No Pokemon',
        defaultAlt: 'No active Pokemon'
    };
    pokeDisplay.displayPokemonDataInBattle(getActivePokemon(), playerElements, 'back');

    updateWildPokemonDisplay(); // Calls displayPokemonDataInBattle for wild Pokemon

    partyDisplay.updatePartyDisplay();
    storageDisplay.updateStorageDisplay();

    // Event listeners for dynamically generated content (party, storage) should be handled by delegation
    // in main.js or here if not already.
}


// --- Helper: Update Wild Pokémon Battle Display ---
export function updateWildPokemonDisplay() {
    const wildPokemonContainer = document.getElementById('wild-pokemon');
    const wildPokemonInfoDiv = wildPokemonContainer?.querySelector('.pokemon-info');
    const wildSprite = document.getElementById('wild-sprite');

    if (!wildPokemonContainer || !wildSprite) {
        console.error("Wild Pokémon display elements not found.");
        return;
    }

    // Toggle visibility based on whether a wild Pokémon exists
    const hasWildPokemon = !!gameState.currentWildPokemon;
    wildPokemonContainer.style.display = hasWildPokemon ? '' : 'none'; // Show/hide container
    if(wildPokemonInfoDiv) wildPokemonInfoDiv.style.visibility = hasWildPokemon ? 'visible' : 'hidden';
    wildSprite.style.visibility = hasWildPokemon ? 'visible' : 'hidden';


    const wildElements = {
        nameEl: document.getElementById('wild-name'),
        levelEl: document.getElementById('wild-level'),
        spriteEl: wildSprite,
        hpTextEl: document.getElementById('wild-hp-text'),
        hpBarId: 'wild-hp', // ID of the FILLER div
        statsEl: document.getElementById('wild-stats'),
        defaultName: 'Wild Area', // Or some other placeholder
        defaultAlt: 'No wild Pokemon'
    };
    pokeDisplay.displayPokemonDataInBattle(gameState.currentWildPokemon, wildElements, 'front');
}


// --- Helper: Update General Player Stats (Money, Pokedex, Wins) ---
function _updatePlayerStatsDisplay() {
    const uniqueSpecies = new Set();
    const uniqueShinySpecies = new Set();
    const allPlayerPokemon = [...gameState.party.filter(p => p), ...gameState.allPokemon.filter(p => p)];

    allPlayerPokemon.forEach(pokemon => {
        if (pokemon.pokedexId) {
            uniqueSpecies.add(pokemon.pokedexId);
            if (pokemon.isShiny) uniqueShinySpecies.add(pokemon.pokedexId);
        }
    });

    let pokedexText = `${uniqueSpecies.size}`;
    if (uniqueShinySpecies.size > 0) pokedexText += ` (${uniqueShinySpecies.size} Shiny)`;

    document.getElementById('pokedex-count').textContent = pokedexText;
    document.getElementById('battle-wins').textContent = gameState.battleWins.toString();
    document.getElementById('money').textContent = formatNumberWithDots(gameState.money) + "₽";

    // Update Item Bar Counts & Disabled States (this part is complex due to item-specific logic)
    _updateItemBarItems();
}

// --- Helper: Update Item Bar Items (Counts & Disabled States) ---
function _updateItemBarItems() {
    const itemBarButtons = document.querySelectorAll('.items-bar .item-button');
    itemBarButtons.forEach(button => {
        const itemId = button.dataset.itemId;
        if (!itemId) return;

        const countSpan = button.querySelector(`.item-bar-count-text`); // More specific selector
        const itemInfo = pokeballData[itemId] || itemData[itemId];
        const count = (pokeballData[itemId] ? gameState.pokeballs[itemId] : gameState.items[itemId]) || 0;

        if (countSpan) countSpan.textContent = count.toString();

        button.style.display = (count > 0 || (itemId === 'pokeball' && pokeballData[itemId])) ? '' : 'none';


        let specificCondition = true;
        const activePokemon = getActivePokemon();
        const wildPokemon = gameState.currentWildPokemon;

        if (pokeballData[itemId]) { // It's a ball
            specificCondition = !!wildPokemon; // Can only use if wild Pokémon exists
        } else if (itemData[itemId]) { // It's a usable item
            const itm = itemData[itemId];
            if (itm.effectType === 'active_pokemon_percentage' || itm.effectType === 'active_pokemon_full') {
                specificCondition = activePokemon && activePokemon.currentHp < activePokemon.maxHp && (activePokemon.currentHp > 0 || !!itm.canRevive);
            } else if (itm.effectType === 'party_full') {
                specificCondition = gameState.party.some(p => p && p.currentHp < p.maxHp);
            } else if (itm.effectType === 'evolution_item') {
                specificCondition = activePokemon && itm.evolutionTargets?.some(target => target.pokemon === activePokemon.name);
            } else if (itm.effectType === 'level_up') {
                specificCondition = activePokemon && activePokemon.level < 100;
            } else if (!activePokemon && (itm.effectType.includes('active_pokemon') || itm.effectType === 'evolution_item' || itm.effectType === 'level_up')) {
                 specificCondition = false; // Cannot use on active Pokémon if no active Pokémon
            }
        }

        button.disabled = count <= 0 ||
                          gameState.battleInProgress ||
                          gameState.eventModalActive ||
                          !specificCondition;
    });
}


// --- Helper: Update Main Action Buttons State ---
function _updateMainActionButtonsState() {
    const fightBtn = document.getElementById('fight-btn');
    const autoFightBtn = document.getElementById('auto-fight-btn');
    const freeHealBtn = document.getElementById('free-heal-btn');
    const routeSelectContainer = document.getElementById('route-select-container');
    const leaveRouteBtn = document.getElementById('leave-route-btn');

    const activePokemon = getActivePokemon();
    const playerCanInitiateBattleAction = activePokemon && activePokemon.currentHp > 0;

    if (gameState.currentRoute === null) {
        fightBtn.textContent = "Select a Route";
        fightBtn.disabled = true;
        if (routeSelectContainer) routeSelectContainer.style.removeProperty('visibility'); // Show selector
        if (leaveRouteBtn) leaveRouteBtn.style.visibility = 'hidden'; // Hide leave button
    } else { // On a route
        fightBtn.textContent = gameState.currentWildPokemon ? "Fight!" : "Find Pokémon";
        fightBtn.disabled = gameState.battleInProgress || gameState.autoBattleActive || !playerCanInitiateBattleAction || gameState.eventModalActive;
        if (routeSelectContainer) routeSelectContainer.style.visibility = 'hidden'; // Hide selector
        if (leaveRouteBtn) {
            leaveRouteBtn.style.removeProperty('visibility'); // Show leave button
            leaveRouteBtn.disabled = gameState.battleInProgress || gameState.autoBattleActive || gameState.eventModalActive;
        }
    }

    if (!gameState.autoFightUnlocked) {
        autoFightBtn.textContent = `Auto-Fight (LOCKED - ${AUTO_FIGHT_UNLOCK_WINS} wins)`;
        autoFightBtn.disabled = true;
        autoFightBtn.style.backgroundColor = "#aaa"; // Keep greyed out style
    } else {
        autoFightBtn.textContent = gameState.autoBattleActive ? 'Stop Auto-Fight' : 'Start Auto-Fight';
        autoFightBtn.disabled = (gameState.autoBattleActive ? false : (gameState.currentRoute === null || gameState.battleInProgress || gameState.eventModalActive || !playerCanInitiateBattleAction));
        autoFightBtn.style.backgroundColor = gameState.autoBattleActive ? '' : '#4CAF50'; // Default or green
    }

    if (freeHealBtn) {
        const hasNoMoomooMilk = (gameState.items.moomoomilk || 0) === 0;
        const hasNoHyperPotion = (gameState.items.hyperpotion || 0) === 0;
        const canShowFreeHeal = gameState.money < 800 &&
                                (hasNoMoomooMilk && hasNoHyperPotion) &&
                                !gameState.battleInProgress &&
                                !gameState.eventModalActive &&
                                gameState.currentRoute === null; // Only show if not on a route

        freeHealBtn.style.visibility = canShowFreeHeal ? 'visible' : 'hidden';
        freeHealBtn.disabled = !canShowFreeHeal;
    }
}

// --- Helper: Update Item Bar Tooltips ---
function _updateItemBarTooltips() {
    const itemDisplayElements = document.querySelectorAll('.items-bar .item-display');
    itemDisplayElements.forEach(itemEl => {
        const itemId = itemEl.dataset.itemId;
        if (!itemId) return;
        const tooltipEl = itemEl.querySelector('.custom-tooltip'); // Tooltip is child of item-display
        if (!tooltipEl) return;

        const itemInfo = pokeballData[itemId] || itemData[itemId];
        tooltipEl.textContent = itemInfo?.description || itemInfo?.name || 'Item information not available.';
    });
}


// --- Route Selector Population --- (Could be in a routeUI.js or here)
export function populateRouteSelector() {
    const routeSelect = document.getElementById('route-select');
    if (!routeSelect) return;

    const currentMinLevel = calculateMinPartyLevel(); // From gameLogic
    const previouslySelectedRoute = routeSelect.value; // Preserve selection if possible

    routeSelect.innerHTML = ''; // Clear existing options

    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "-- Select a Route --";
    routeSelect.appendChild(defaultOption);

    Object.keys(routes).sort((a, b) => parseInt(a) - parseInt(b)).forEach(routeKey => {
        const route = routes[routeKey];
        const option = document.createElement('option');
        option.value = routeKey;

        let optionText = route.name;
        if (currentMinLevel < route.LevelRequirement) {
            option.disabled = true;
            // Append requirement to the name for disabled options
            optionText += ` (Lvl ${route.LevelRequirement} req.)`;
        }
        option.textContent = optionText;
        routeSelect.appendChild(option);
    });
    // Try to restore selection, or current game state route, or default to empty
    routeSelect.value = gameState.currentRoute !== null ? gameState.currentRoute.toString() : (previouslySelectedRoute || "");
}


// --- UI Interaction Handlers that call logic ---
// These are called by event listeners set up in main.js
// They bridge UI events to game logic calls.

export function handlePokemonSpriteClick(index, locationType) {
    let pokemonToDisplay = null;
    if (locationType === 'party' && index >=0 && index < gameState.party.length) {
        pokemonToDisplay = gameState.party[index];
    } else if (locationType === 'storage' && index >=0 && index < gameState.allPokemon.length) {
        pokemonToDisplay = gameState.allPokemon[index];
    } else if (locationType === 'player') { // -1 or other special marker for active player
        pokemonToDisplay = getActivePokemon();
    } else if (locationType === 'wild') { // -1 or special marker for wild
        pokemonToDisplay = gameState.currentWildPokemon;
    }

    if (pokemonToDisplay) {
        // Pass the actual changePokemonNickname function from partyLogic
        showPokemonImageModal(pokemonToDisplay, index, locationType, changePokemonNickname);
    }
}

export function addToPartyDialog(storageIndex) {
    // This function provides the UI (prompt) for adding to party.
    // The actual logic is in partyLogic.js's addToParty.
    const pokemonToMove = gameState.allPokemon[storageIndex];
    if (!pokemonToMove) {
        addBattleLog("Error: Selected Pokémon not found in PC.");
        return;
    }

    const availableSlots = [];
    for (let i = 0; i < 6; i++) {
        if (gameState.party[i] === null) {
            availableSlots.push(i);
        }
    }

    if (availableSlots.length === 0) {
        const slotChoice = prompt(`Party is full! Replace which Pokémon in party? (1-6) to move ${pokemonToMove.name} from PC. Cancel to abort.`);
        if (slotChoice === null) return; // User cancelled
        const slot = parseInt(slotChoice) - 1;
        if (!isNaN(slot) && slot >= 0 && slot < 6) {
            addToPartyLogic(storageIndex, slot); // Call partyLogic
        } else {
            alert("Invalid slot number. Please enter a number between 1 and 6.");
        }
    } else {
        // Automatically add to the first available slot if there's space.
        addToPartyLogic(storageIndex, availableSlots[0]); // Call partyLogic
    }
}

export function confirmReleasePokemon(storageIndex) {
    // This calls the logic function which includes the confirm dialog
    confirmReleasePokemonLogic(storageIndex); // from partyLogic
}


// Re-export modal functions so main.js can attach them to listeners
export {
    showStarterSelectionModal,
    showSettingsModal, closeSettingsModal,
    showExportModal, closeExportModal,
    showImportModal, closeImportModal,
    // showPokemonImageModal is handled by handlePokemonSpriteClick
    closePokemonImageModal,
    showEventModalUI as showEventModal, // Alias to avoid conflict if gameLogic also had one
    closeEventModal,
    togglePcDrawer,
    // copyExportDataToClipboard, processImportDataFromModal are usually tied to specific buttons
    // and might be better handled by direct import in main.js if their callers are static.
    // For now, assume main.js imports them if needed for static buttons.
};
