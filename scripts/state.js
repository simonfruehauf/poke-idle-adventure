// state.js

export let gameState = {
    money: 100,
    pokeballs: {
        pokeball: 5,
        greatball: 0,
        ultraball: 0,
        masterball: 0
    },
    potions: {
        potion: 0,
        hyperpotion: 0,
        moomoomilk: 0
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

export let pokeballData = {};

export let potionData = {};