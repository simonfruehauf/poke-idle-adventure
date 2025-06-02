// saveLoad.js
import { gameState, routes } from './state.js';
import { Pokemon } from './pokemon.js';
import { addBattleLog } from './utils.js';
import { updateDisplay, populateRouteSelector, showExportModal, showImportModal, closeImportModal } from './ui.js'; // populateRouteSelector might be needed if load changes avg level

export function serializePokemon(p) {
    if (!p) return null;
    return {
        name: p.name,
        id: p.id,
        level: p.level,
        currentHp: p.currentHp,
        exp: p.exp,
        pokedexId: p.pokedexId,
        evolutionTargetName: p.evolutionTargetName,
        evolveLevel: p.evolveLevel,
        caughtWithBall: p.caughtWithBall || 'pokeball',
        isShiny: p.isShiny,
    };
}

export function deserializePokemon(savedPkmnData) {
    if (!savedPkmnData) return null;
    const pokemon = new Pokemon(savedPkmnData.name, savedPkmnData.level, savedPkmnData.isShiny, savedPkmnData.caughtWithBall || 'pokeball');
    pokemon.id = savedPkmnData.id || (Date.now() + Math.random());
    pokemon.currentHp = savedPkmnData.currentHp;
    pokemon.exp = savedPkmnData.exp;
    return pokemon;
}

export function saveGame() {
    const saveData = {
        money: gameState.money,
        pokeballs: gameState.pokeballs,
        items: gameState.items, // Renamed from potions
        party: gameState.party.map(p => serializePokemon(p)),
        allPokemon: gameState.allPokemon.map(p => serializePokemon(p)),
        currentWildPokemon: serializePokemon(gameState.currentWildPokemon),
        battleWins: gameState.battleWins,
        currentRoute: gameState.currentRoute,
        autoBattleActive: gameState.autoBattleActive, // Will be reset on load, but saved for consistency
        autoFightUnlocked: gameState.autoFightUnlocked,
        xpShareLevel: gameState.xpShareLevel,
        konamiCodeActivated: gameState.konamiCodeActivated
    };
    localStorage.setItem('pokemonIdleGameV2', JSON.stringify(saveData));
}

export function manualSaveGame() {
    saveGame();
    addBattleLog("Game Saved!");
}

export function loadGame() {
    const saveDataString = localStorage.getItem('pokemonIdleGameV2');
    if (saveDataString) {
        const data = JSON.parse(saveDataString);
        gameState.money = data.money || 100;
        gameState.pokeballs = {
            pokeball: (data.pokeballs && data.pokeballs.pokeball !== undefined) ? data.pokeballs.pokeball : 5,
            greatball: (data.pokeballs && data.pokeballs.greatball) || 0,
            ultraball: (data.pokeballs && data.pokeballs.ultraball) || 0,
            masterball: (data.pokeballs && data.pokeballs.masterball) || 0,
        };
        // Handle loading old saves with 'potions' key, then migrate to 'items'
        gameState.items = data.items || data.potions || { potion: 0, hyperpotion: 0, moomoomilk: 0 };
        gameState.battleWins = data.battleWins || 0;
        gameState.currentRoute = data.currentRoute !== undefined ? data.currentRoute : 1; // Default to route 1 if not set
        gameState.autoFightUnlocked = data.autoFightUnlocked || false;
        gameState.autoBattleActive = false; // Always start with auto-battle off
        gameState.xpShareLevel = data.xpShareLevel || 0;
        gameState.konamiCodeActivated = data.konamiCodeActivated || false;

        if (data.party) gameState.party = data.party.map(pData => pData ? deserializePokemon(pData) : null);
        const firstHealthyInParty = gameState.party.findIndex(p => p && p.currentHp > 0);
        gameState.activePokemonIndex = firstHealthyInParty !== -1 ? firstHealthyInParty : 0;

        if (data.allPokemon) gameState.allPokemon = data.allPokemon.map(pData => pData ? deserializePokemon(pData) : null).filter(p => p); // Filter out any nulls from bad saves
        gameState.currentWildPokemon = data.currentWildPokemon ? deserializePokemon(data.currentWildPokemon) : null;

        // Route info will be updated by updateDisplay or changeRoute if called by initGame
        // populateRouteSelector(); // Called in initGame after load
        // updateDisplay(); // Called in initGame after load
    }
}

export function confirmClearSave() {
    if (window.confirm("Are you sure you want to clear all saved data? This cannot be undone!")) {
        clearSaveData();
    }
}

export function clearSaveData() {
    localStorage.removeItem('pokemonIdleGameV2');
    addBattleLog("Save data cleared. Reloading game...");
    setTimeout(() => { location.reload(); }, 1500);
}

export function exportSaveData() {
    const saveDataString = localStorage.getItem('pokemonIdleGameV2');
    if (!saveDataString) {
        addBattleLog("No save data found to export.");
        alert("No save data found to export.");
        return;
    }

    // Obfuscate the data using Base64
    let obfuscatedData;
    try {
        obfuscatedData = btoa(saveDataString); // Encode to Base64
    } catch (error) {
        addBattleLog("Error obfuscating save data for export.");
        alert("Error preparing save data for export. Could not encode data.");
        return;
    }

    showExportModal(obfuscatedData); // Call the UI function to show the modal
    addBattleLog("Save data exported (obfuscated)!");
}

export function importSaveData() {
    showImportModal(); // Show the modal instead of a prompt
}

export function handlePastedImportData(importedString) {
    // This function contains the core logic previously in importSaveData
    try {
        // De-obfuscate the data using Base64
        let deobfuscatedString;
        try {
            deobfuscatedString = atob(importedString); // Decode from Base64
        } catch (error) {
            throw new Error("Invalid import format. Data does not appear to be a valid export.");
        }

        // Basic validation: Try to parse and check for a key property
        const data = JSON.parse(deobfuscatedString);
        if (typeof data.money === 'undefined' || typeof data.party === 'undefined') {
            throw new Error("Invalid save data structure.");
        }
        closeImportModal(); // Close modal on successful start of import
        localStorage.setItem('pokemonIdleGameV2', deobfuscatedString); // Store the original JSON string
        addBattleLog("Save data imported successfully! Reloading game to apply changes...");
        setTimeout(() => { location.reload(); }, 1500);
    } catch (error) {
        // Modal remains open on error, allowing user to correct or cancel.
        addBattleLog(`Error importing save data: ${error.message}. Please ensure the data is correct and was exported from this game.`);
        alert(`Error importing save data: ${error.message}. Please ensure the data is correct and was exported from this game.`);
    }
}