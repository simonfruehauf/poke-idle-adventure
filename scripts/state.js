// state.js

export let gameState = {
    money: 100,
    pokeballs: {
        pokeball: 5, // Standard ball
        greatball: 0, // Better chance
        ultraball: 0, // Even better chance
        masterball: 0 // Guaranteed catch
    },
    items: { // Renamed from potions
        potion: 0,
        hyperpotion: 0,
        moomoomilk: 0,
        firestone: 0,
        waterstone: 0,
        thunderstone: 0,
        moonstone: 0,
        leafstone: 0
    },
    party: [null, null, null, null, null, null],
    allPokemon: [],
    battleWins: 0,
    currentRoute: 1,
    currentWildPokemon: null,
    activePokemonIndex: 0,
    battleInProgress: false,
    autoBattleActive: false,
    autoFightUnlocked: false,
    xpShareLevel: 0,
    konamiCodeActivated: false
};

export let routes = {};

export let pokemonBaseStatsData = {};

export let pokeballData = {}; // Data for different types of Pokeballs

export let itemData = {}; // Renamed from potionData, holds data for usable items like potions