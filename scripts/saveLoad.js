// saveLoad.js
import { gameState, routes } from './state.js';
import { Pokemon } from './pokemon.js';
import { addBattleLog } from './utils.js';
import { updateDisplay, populateRouteSelector, showExportModal, showImportModal, closeImportModal } from './ui.js'; // populateRouteSelector might be needed if load changes avg level
import { gameState as importedGameState } from './state.js'; // Use an alias to avoid conflict if needed, or ensure gameState is consistently used.
export function serializePokemon(p) {
    if (!p) return null;
    return {
        nickname: p.nickname,
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

export async function deserializePokemon(savedPkmnData) { // Now async
    if (!savedPkmnData) return null;
    // Pass the saved nickname to the constructor.
    // The Pokemon constructor will default nickname to species name if savedPkmnData.nickname is null/undefined.
    const pokemon = await Pokemon.create( // Use Pokemon.create
        savedPkmnData.name,
        savedPkmnData.level,
        savedPkmnData.isShiny, // isShinyOverride
        savedPkmnData.caughtWithBall || 'pokeball',
        savedPkmnData.nickname);
    pokemon.id = savedPkmnData.id || (Date.now() + Math.random());
    pokemon.currentHp = savedPkmnData.currentHp;
    pokemon.exp = savedPkmnData.exp;

    // Ensure loaded Pokémon at Lvl 100 have their level capped and EXP zeroed.
    if (pokemon.level >= 100) {
        pokemon.level = 100;
        pokemon.exp = 0;
        pokemon.expToNext = pokemon.getExpToNext(); // Ensure expToNext is also correct
    }
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
        konamiCodeActivated: gameState.konamiCodeActivated,
        // Egg Features
        eggNextAvailableTimestamp: gameState.eggNextAvailableTimestamp,
        eggIsClaimable: gameState.EggIsClaimable,
        playerHasUnincubatedEgg: gameState.playerHasUnincubatedEgg,
        incubator: gameState.incubator,

    };
    localStorage.setItem('pokemonIdleGameV2', JSON.stringify(saveData));
}

export function manualSaveGame() {
    saveGame();
    addBattleLog("Game Saved!");
}

export async function loadGame() { // Now async
    const saveDataString = localStorage.getItem('pokemonIdleGameV2');
    if (saveDataString) {
        const data = JSON.parse(saveDataString);
        // Default structure for pokeballs, including new ones
        const defaultPokeballsState = {
            pokeball: 5, greatball: 0, ultraball: 0, masterball: 0,
            safariball: 0, sportball: 0, fastball: 0, friendball: 0,
            heavyball: 0, levelball: 0, loveball: 0, lureball: 0, moonball: 0,
            healball: 0
        };

        gameState.money = data.money || 100;
        gameState.pokeballs = {};

        for (const ballId in defaultPokeballsState) {
            if (data.pokeballs && data.pokeballs[ballId] !== undefined) {
                gameState.pokeballs[ballId] = data.pokeballs[ballId];
            } else {
                gameState.pokeballs[ballId] = defaultPokeballsState[ballId];
            }
        }
        // Ensure 'pokeball' specifically defaults to 5 if not in save, overriding the loop's 0 default if necessary
        if (!(data.pokeballs && data.pokeballs.pokeball !== undefined)) {
            gameState.pokeballs.pokeball = 5;
        }

        // Handle loading old saves with 'potions' key, then migrate to 'items'
        gameState.items = data.items || data.potions || { potion: 0, hyperpotion: 0, moomoomilk: 0 };
        gameState.battleWins = data.battleWins || 0;
        gameState.currentRoute = data.currentRoute !== undefined ? data.currentRoute : 1; // Default to route 1 if not set
        if (routes[gameState.currentRoute]) document.getElementById('route-info').textContent = routes[gameState.currentRoute].description;
        gameState.autoFightUnlocked = data.autoFightUnlocked || false;
        gameState.autoBattleActive = false; // Always start with auto-battle off
        gameState.xpShareLevel = data.xpShareLevel || 0;
        gameState.konamiCodeActivated = data.konamiCodeActivated || false;

        if (data.party) {
            const partyPromises = data.party.map(pData => pData ? deserializePokemon(pData) : Promise.resolve(null));
            gameState.party = await Promise.all(partyPromises);
        }
        const firstHealthyInParty = gameState.party.findIndex(p => p && p.currentHp > 0);
        gameState.activePokemonIndex = firstHealthyInParty !== -1 ? firstHealthyInParty : 0;

        if (data.allPokemon) {
            const allPokemonPromises = data.allPokemon.map(pData => pData ? deserializePokemon(pData) : Promise.resolve(null));
            const resolvedAllPokemon = await Promise.all(allPokemonPromises);
            gameState.allPokemon = resolvedAllPokemon.filter(p => p); // Filter out any nulls
        }
        
        gameState.currentWildPokemon = data.currentWildPokemon ? await deserializePokemon(data.currentWildPokemon) : null;

        // Load Egg Features
        gameState.eggNextAvailableTimestamp = data.mysteryEggNextAvailableTimestamp || null;
        gameState.EggIsClaimable = data.mysteryEggIsClaimable || false;
        gameState.playerHasUnincubatedEgg = data.playerHasUnincubatedEgg || false;
        gameState.incubator = data.incubator || {
            eggDetails: null,
            incubationEndTime: null,
            isHatchingReady: false
        };

        // Route info will be updated by updateDisplay or changeRoute if called by initGame
        // populateRouteSelector(); // Called in initGame after load
        // updateDisplay(); // Called in initGame after load
    }
    else{
        console.log("Failed to load. No save data found.")
    }
}

export function confirmClearSave() {
    if (window.confirm("Are you sure you want to clear all saved data? This cannot be undone!")) {
        clearSaveData();
    }
}

export function clearSaveData() {
    localStorage.removeItem('pokemonIdleGameV2');
    const saveDataString = localStorage.getItem('pokemonIdleGameV2');
    addBattleLog("Save data cleared. Reloading game...");
    setTimeout(() => { location.reload(); }, 1000);
}

export function exportSaveData() {
    const saveDataString = localStorage.getItem('pokemonIdleGameV2');
    if (!saveDataString) {
        addBattleLog("No save data found to export.");
        alert("No save data found to export.");
        return;
    }

    // Obfuscate the data
    let obfuscatedData;
    try {
        // Encode string to UTF-8 bytes, then to a binary string for btoa
        const encoder = new TextEncoder();
        const utf8Bytes = encoder.encode(saveDataString);
        // Convert Uint8Array to binary string (each char code is a byte value)
        // Process in chunks to avoid "RangeError: Maximum call stack size exceeded" for large strings
        let binaryString = "";
        const CHUNK_SIZE = 0x8000; 
        for (let i = 0; i < utf8Bytes.length; i += CHUNK_SIZE) {
            binaryString += String.fromCharCode.apply(null, utf8Bytes.subarray(i, i + CHUNK_SIZE));
        }
        obfuscatedData = btoa(binaryString);
    } catch (error) {
        console.error("Error encoding save data:", error);
        addBattleLog("Error preparing save data for export: " + error.message);
        alert("Error preparing save data for export. Could not encode data. " + error.message);
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
            // Decode from Base64 to binary string
            const binaryString = atob(importedString);
            // Convert binary string to Uint8Array
            const utf8Bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                utf8Bytes[i] = binaryString.charCodeAt(i);
            }
            // Decode UTF-8 bytes to string
            const decoder = new TextDecoder(); // Defaults to 'utf-8'
            deobfuscatedString = decoder.decode(utf8Bytes);
        } catch (error) {
            console.error("Error decoding import data:", error);
            throw new Error("Invalid import format. Data could not be decoded. " + error.message);
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