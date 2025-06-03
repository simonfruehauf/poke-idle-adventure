// state.js

export let gameState = {
    money: 100,
    pokeballs: {
        pokeball: 5, // Standard ball
        greatball: 0, // Better chance
        ultraball: 0, // Even better chance
        masterball: 0, // Guaranteed catch
        safariball: 0,
        sportball: 0,
        fastball: 0,
        friendball: 0,
        heavyball: 0,
        levelball: 0,
        loveball: 0,
        lureball: 0,
        moonball: 0,
        premierball: 0
    },
    items: { // Renamed from potions
        potion: 0,
        hyperpotion: 0,
        moomoomilk: 0,
        firestone: 0,
        waterstone: 0,
        thunderstone: 0,
        moonstone: 0,
        leafstone: 0,
        rarecandy: 0,
        sunstone: 0,
        kingsrock: 0,
        metalcoat: 0,
        dragonscale: 0,
        upgrade: 0
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
    konamiCodeActivated: false,
    eventModalActive: false,      // True if the post-battle event modal is shown
    currentPostBattleEvent: null, // Stores the data of the currently active post-battle event
    eventModalTimerId: null       // Timer ID for auto-closing event modal during auto-battle
};

export let routes = {};

export let pokemonBaseStatsData = {};

export let pokeballData = {}; // Data for different types of Pokeballs

export let itemData = {}; // Renamed from potionData, holds data for usable items like potions

export let eventDefinitions = { globalEventChance: 0, events: [] }; // To store loaded events.json
