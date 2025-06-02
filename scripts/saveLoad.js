// saveLoad.js
import { gameState, routes } from './state.js';
import { Pokemon } from './pokemon.js';
import { addBattleLog } from './utils.js';
import { updateDisplay, populateRouteSelector } from './ui.js'; // populateRouteSelector might be needed if load changes avg level

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
        potions: gameState.potions,
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
        gameState.potions = data.potions || { potion: 0, hyperpotion: 0, moomoomilk: 0 };
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