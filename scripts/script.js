// Routes configuration
let routes = {}; // Will be loaded from routes.json

const STARTER_POKEMON_NAMES = ["Bulbasaur", "Charmander", "Squirtle", "Pikachu"]; 

const POKEMON_SPRITE_BASE_URL = "./sprites/pokemon/"; // Changed to local path
const AUTO_FIGHT_UNLOCK_WINS = 10; // Wins needed to unlock auto-fight
const SHINY_CHANCE = 1 / 100; // Chance for a Pokemon to be shiny (e.g., 1 in 1024)
let autoFightIntervalId = null; // For managing the auto-fight loop

const XP_SHARE_CONFIG = [
    { cost: 10000, percentage: 0.05, name: "EXP Share (5%)" }, // To get to level 1
    { cost: 25000, percentage: 0.10, name: "EXP Share (10%)" }, // To get to level 2
    { cost: 50000, percentage: 0.15, name: "EXP Share (15%)" }, // To get to level 3
    { cost: 99999, percentage: 0.25, name: "EXP Share (25%)" }, // To get to level 3
];

let pokemonBaseStatsData = {}; // Will be loaded from statmap.json
let pokeballData = {}; // Will be loaded from pokeballs.json
let potionData = {};   // Will be loaded from potions.json
// Game state
let gameState = {
    money: 100,
    pokeballs: { // Changed to an object
        pokeball: 5,
        greatball: 0,
        ultraball: 0
    },
    potions: { // To store potion counts
        potion: 0,
        hyperpotion: 0,
        moomoomilk: 0
    },
    party: [null, null, null, null, null, null], // 6 party slots
    allPokemon: [], // All caught pokemon
    battleWins: 0,
    currentRoute: 1, // Can be null if not on a route
    currentWildPokemon: null,
    activePokemonIndex: 0, // Index in party
    battleInProgress: false,
    autoBattleActive: false,
    autoFightUnlocked: false,
    xpShareLevel: 0 // 0 = Not owned, 1 = Mk1, 2 = Mk2, 3 = Mk3
    
};

// Pokemon class with proper stats
class Pokemon {
    constructor(name, level = 1, isShinyOverride = null, caughtWithBall = 'pokeball') {
        this.name = name;
        this.id = Date.now() + Math.random(); // Unique ID for this instance
        this.level = level;
        this.caughtWithBall = caughtWithBall; // Store the ball ID
        this.isShiny = isShinyOverride !== null ? isShinyOverride : (Math.random() < SHINY_CHANCE);
        const statsData = this.getStatsData(name); // Gets { base: ..., growth: ... }
        this.pokedexId = statsData.pokedexId;
        this.evolutionTargetName = statsData.evolution;
        this.evolveLevel = statsData.evolveLevel;
        this.baseStats = { ...statsData.base }; // Ensure we have a copy
        this.growthRates = { ...statsData.growth }; // Ensure we have a copy
        this.currentHp = this.maxHp;
        this.exp = 0;
        this.expToNext = this.getExpToNext();
    }
    getStatsData(name) {
        const speciesData = pokemonBaseStatsData[name] || {}; // Ensure speciesData is an object

        // Check if speciesData and its nested properties 'base' and 'growth' exist
        if (typeof speciesData.base === 'object' && typeof speciesData.growth === 'object' && typeof speciesData.pokedexId === 'number') {
            const requiredBaseStats = ['hp', 'attack', 'defense', 'speed'];
            const requiredGrowthStats = ['hp', 'attack', 'defense', 'speed'];

            const hasAllBase = requiredBaseStats.every(stat => typeof speciesData.base[stat] === 'number');
            const hasAllGrowth = requiredGrowthStats.every(stat => typeof speciesData.growth[stat] === 'number');

            if (hasAllBase && hasAllGrowth ) {
                return {
                    pokedexId: speciesData.pokedexId,
                    evolution: speciesData.evolution, // Can be null
                    evolveLevel: speciesData.evolveLevel, // Can be null
                    base: { ...speciesData.base }, // Return a copy
                    growth: { ...speciesData.growth } // Return a copy
                };
            }
        }
        // Fallback for missing/incomplete data
        console.warn(`Stat data (pokedexId, base, or growth) for ${name} is missing or incomplete in statmap.json. Using default values.`);
        return {
            pokedexId: 0, evolution: null, evolveLevel: null,
            base: { hp: 50, attack: 50, defense: 50, speed: 50 }, // Default base stats
            growth: { hp: 1.5, attack: 1.0, defense: 1.0, speed: 1.0 } // Default growth rates
        };
    }

    get maxHp() {
        return Math.floor(this.baseStats.hp + (this.level - 1) * this.growthRates.hp);
    }

    get attack() {
        return Math.floor(this.baseStats.attack + (this.level - 1) * this.growthRates.attack);
    }
    get defense() {
        return Math.floor(this.baseStats.defense + (this.level - 1) * this.growthRates.defense);
    }
    get speed() {
        return Math.floor(this.baseStats.speed + (this.level - 1) * this.growthRates.speed);
    }

    getExpToNext() {
        return this.level * 100;
    }

    takeDamage(damage) {
        // Apply defense to reduce damage
        const actualDamage = Math.max(1, damage - Math.floor(this.defense / 4));
        this.currentHp = Math.max(0, this.currentHp - actualDamage);
        return this.currentHp <= 0;
    }

    heal() {
        this.currentHp = this.maxHp;
    }

    healPartial(percentage) {
        const healAmount = Math.floor(this.maxHp * percentage);
        this.currentHp = Math.min(this.maxHp, this.currentHp + healAmount);
    }

    gainExp(amount) {
        this.exp += amount;
        while (this.exp >= this.expToNext && this.level < 100) {
            this.exp -= this.expToNext;
            this.levelUp();
        }
    }

    levelUp() {
        const oldMaxHp = this.maxHp;
        this.level++;
        this.expToNext = this.getExpToNext();
        // Heal proportionally when leveling up
        const hpRatio = this.currentHp / oldMaxHp;
        this.currentHp = Math.floor(this.maxHp * hpRatio);
        addBattleLog(`${this.name} leveled up to ${this.level}!`);
        populateRouteSelector(); // Update route dropdown if level up affects average
    }

    evolve() {
        if (!this.evolutionTargetName || !pokemonBaseStatsData[this.evolutionTargetName]) {
            addBattleLog(`${this.name} cannot evolve further or evolution data is missing.`);
            return false;
        }
        if (this.level < this.evolveLevel) {
            addBattleLog(`${this.name} is not high enough level to evolve.`);
            return false;
        }

        const oldName = this.name;
        this.name = this.evolutionTargetName;
        const newStatsData = this.getStatsData(this.name);
        this.pokedexId = newStatsData.pokedexId;
        this.evolutionTargetName = newStatsData.evolution;
        this.evolveLevel = newStatsData.evolveLevel;
        this.baseStats = newStatsData.base;
        this.growthRates = newStatsData.growth;
        this.heal(); // Fully heal on evolution
        this.exp = 0; // Reset EXP for the new stage
        addBattleLog(`Congratulations! Your ${oldName} evolved into ${this.name}!`);
        return true;
    }
}

async function loadGameData() {
    try {
        const routesResponse = await fetch('json/routes.json');
        if (!routesResponse.ok) {
            throw new Error(`HTTP error! status: ${routesResponse.status} while fetching json/routes.json`);
        }
        routes = await routesResponse.json();

        const statsResponse = await fetch('json/statmap.json');
        if (!statsResponse.ok) {
            throw new Error(`HTTP error! status: ${statsResponse.status} while fetching json/statmap.json`);
        }
        pokemonBaseStatsData = await statsResponse.json();

        const pokeballsResponse = await fetch('json/pokeballs.json');
        if (!pokeballsResponse.ok) {
            throw new Error(`HTTP error! status: ${pokeballsResponse.status} while fetching json/pokeballs.json`);
        }
        pokeballData = await pokeballsResponse.json();

        const potionsResponse = await fetch('json/potions.json');
        if (!potionsResponse.ok) {
            throw new Error(`HTTP error! status: ${potionsResponse.status} while fetching json/potions.json`);
        }
        potionData = await potionsResponse.json();

        console.log("Game data loaded successfully.");
    } catch (error) {
        console.error("Failed to load game data:", error);
        document.body.innerHTML = `<div style="color: red; text-align: center; padding: 20px; font-family: sans-serif;">
                                    <h1>Error Initializing Game</h1>
                                    <p>Could not load essential game data (routes.json, statmap.json, pokeballs.json, or potions.json). 
                                       Please check the console for details and ensure the files are in the correct 'stats/' or 'items/' directory, 
                                       then try refreshing the page.</p>
                                    </div>`;
        throw error; // Re-throw to stop further initialization
    }
}

// Initialize game
async function initGame() {
    await loadGameData(); // Wait for data to load before proceeding
    
    const savedGame = localStorage.getItem('pokemonIdleGameV2');
    if (savedGame) {
        loadGame(); // This will update gameState, call changeRoute, updateDisplay
        startAutoLoop();
        // Ensure a wild pokemon is present if loadGame didn't trigger a spawn or if route had no pokemon
        // Wild pokemon loading is now handled by loadGame. If null, player must "Find Pokemon".
        // if (!gameState.currentWildPokemon) {
        //     spawnWildPokemon(); // This will also call updateWildPokemonDisplay
        // }
        updateDisplay(); // Final update after everything
    } else {
        // Fresh start - prompt for starter
        await showStarterSelectionModal(); // Handles adding starter to party
        
        // Manually set up initial route display for route 1 as changeRoute won't be called by loadGame
        if (routes && routes[gameState.currentRoute]) {
            document.getElementById('route-info').textContent = routes[gameState.currentRoute].description; // Info text still useful
        }
        
        gameState.currentWildPokemon = null; // No wild Pokemon on fresh start
        if (gameState.currentRoute === 1 && !savedGame) { // Only if truly fresh start on route 1
             // No explicit spawn, player starts and needs to "Find Pokemon"
        } else if (gameState.currentRoute === null) {
            document.getElementById('route-info').textContent = "Not currently on a route. Select a route to find Pokémon.";
        }
        populateRouteSelector(); // Populate the new dropdown
        updateDisplay();
        startAutoLoop();    // Start passive income etc.
        saveGame();         // Save initial state with starter
    }
}

async function showStarterSelectionModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('starter-modal');
        const optionsContainer = modal.querySelector('.starter-options');
        optionsContainer.innerHTML = ''; // Clear previous options

        STARTER_POKEMON_NAMES.forEach(name => {
            const pokemonData = pokemonBaseStatsData[name];
            if (!pokemonData) {
                console.warn(`Starter Pokemon ${name} not found in statmap.`);
                return;
            }

            const optionDiv = document.createElement('div');
            optionDiv.className = 'starter-option';
            // Using Pokedex ID for sprite
            const spriteUrl = pokemonData.pokedexId ? `${POKEMON_SPRITE_BASE_URL}front/${pokemonData.pokedexId}.png` : "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
            optionDiv.innerHTML = `
                <img src="${spriteUrl}" alt="${name}">
                <div class="pokemon-name">${name}</div>
            `;
            optionDiv.onclick = () => {
                const starterPokemon = new Pokemon(name, 5); // Start at level 5
                gameState.party[0] = starterPokemon;
                gameState.activePokemonIndex = 0;
                addBattleLog(`You chose ${name} as your starter Pokémon!`);
                modal.style.display = 'none';
                resolve(); // Resolve the promise once selection is made
            };
            optionsContainer.appendChild(optionDiv);
        });
        modal.style.display = 'flex';
    });
}
function startAutoLoop() {

    setInterval(() => {
        updateDisplay();
    }, 10000);
}

async function manualBattle() {
    if (gameState.battleInProgress || gameState.autoBattleActive) {
        if (gameState.autoBattleActive) addBattleLog("Disable Auto-Fight to fight manually.");
        return;
    }

    const activePokemon = getActivePokemon();
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
        spawnWildPokemon(); // This calls updateWildPokemonDisplay
        if (gameState.currentWildPokemon) {
            addBattleLog(`A wild ${gameState.currentWildPokemon.name} appeared! Press Fight to battle.`);
        } // spawnWildPokemon handles logging if no Pokemon found on route
        updateDisplay(); // Update general UI (like fight button text)
        return; // Player needs to click "Fight!" again
    }
    await battle(); // battle is now async
}

function handleRouteChange(routeNumStr) {
    if (routeNumStr === "") { // "-- Select a Route --" option
        if (gameState.currentRoute !== null) leaveCurrentRoute();
        return;
    }
    const routeNum = parseInt(routeNumStr);
    if (!isNaN(routeNum)) {
        changeRoute(routeNum);
    }
}

function changeRoute(routeNum) {

    // Update active state for all route buttons
    if (gameState.autoBattleActive) {
        addBattleLog("Stop Auto-Fight before changing routes.");
        updateDisplay();
        return;
    }
    if (gameState.battleInProgress) {
        addBattleLog("Cannot change routes during a battle action.");
        return;
    }
    if (gameState.currentRoute === routeNum && gameState.currentWildPokemon) {
        addBattleLog(`Already on ${routes[routeNum] ? routes[routeNum].name : 'this route'}.`);
        populateRouteSelector(); // Ensure dropdown reflects current state
        return;
    }
    gameState.currentRoute = routeNum;

    // Update route info
    if (routes && routes[routeNum]) {
        document.getElementById('route-info').textContent = routes[routeNum].description; // Keep this for info
    } else {
        document.getElementById('route-info').textContent = "Loading route info...";
        console.warn(`Route data for ${routeNum} not available. Routes object:`, routes);
    }
    // Spawn new wild pokemon from this route
    gameState.currentWildPokemon = null; // Clear current wild Pokemon when changing route
    addBattleLog(`Moved to ${routes[routeNum] ? routes[routeNum].name : 'selected route'}. Press "Find Pokémon" to search for encounters.`);
    populateRouteSelector(); // Update dropdown to reflect new selection
    updateDisplay();
}

function leaveCurrentRoute() {
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
        toggleAutoFight(); // This will stop auto-fight and update display
    }
    populateRouteSelector(); // Update dropdown to show "Select a Route"
    updateDisplay();
}

function calculateAveragePartyLevel() {
    const activeParty = gameState.party.filter(p => p !== null);
    if (activeParty.length === 0) {
        return 0;
    }
    const totalLevel = activeParty.reduce((sum, p) => sum + p.level, 0);
    return Math.floor(totalLevel / activeParty.length);
}

function populateRouteSelector() {
    const routeSelect = document.getElementById('route-select');
    if (!routeSelect) return;

    const currentAvgLevel = calculateAveragePartyLevel();
    routeSelect.innerHTML = ''; // Clear existing options

    // Add a default "Select a Route" option
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "-- Select a Route --";
    routeSelect.appendChild(defaultOption);

    Object.keys(routes).sort((a,b) => parseInt(a) - parseInt(b)).forEach(routeKey => {
        const route = routes[routeKey];
        const option = document.createElement('option');
        option.value = routeKey;
        let optionText = route.name;

        if (currentAvgLevel < route.avgLevelRequirement) {
            option.disabled = true;
            optionText += ` (Avg Lv. ${route.avgLevelRequirement} req.)`;
        }
        option.textContent = optionText;
        routeSelect.appendChild(option);
    });
    routeSelect.value = gameState.currentRoute !== null ? gameState.currentRoute.toString() : "";
}
function spawnWildPokemon() {
    const route = routes[gameState.currentRoute];
    if (!route) {
        console.error(`Cannot spawn Pokemon: Route ${gameState.currentRoute} data is not loaded or does not exist.`);
        addBattleLog(`No route data for Route ${gameState.currentRoute}. Cannot find Pokémon.`);
        return;
    }

    const availablePokemon = route.pokemon;
    if (!availablePokemon || availablePokemon.length === 0) {
        console.error(`No Pokemon defined for route ${gameState.currentRoute}.`);
        gameState.currentWildPokemon = null;
        addBattleLog(`No Pokémon available on ${route.name}.`);
        updateWildPokemonDisplay(); // Ensure UI reflects no wild Pokemon
        return;

    }

    // Weighted random selection
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

    // Fallback if something went wrong with selection (shouldn't happen if chances are positive)
    if (!selectedPokemonData) selectedPokemonData = availablePokemon[0];

    const level = Math.floor(Math.random() * (selectedPokemonData.levelRange[1] - selectedPokemonData.levelRange[0] + 1)) + selectedPokemonData.levelRange[0];
    gameState.currentWildPokemon = new Pokemon(selectedPokemonData.name, level);

    // Catch button state will be updated in updateDisplay based on new wild Pokemon and pokeballs
    updateWildPokemonDisplay();
    // updateDisplay(); // Caller of spawnWildPokemon should handle general updateDisplay if needed
}

async function battle() {
    let playerPokemon = getActivePokemon();

    if (!playerPokemon || playerPokemon.currentHp <= 0) {
        // Find next available pokemon
        const nextPokemon = findNextHealthyPokemon();
        if (!nextPokemon) {
            addBattleLog("No healthy Pokemon available! Heal your party!");
            return;
        }
        gameState.activePokemonIndex = gameState.party.indexOf(nextPokemon);
        playerPokemon = getActivePokemon(); // Update reference
    }

    if (!gameState.currentWildPokemon) {
        addBattleLog("No wild Pokemon to battle!"); // Should not happen if called correctly by manualBattle/autoBattleTick
        return;
    }

    gameState.battleInProgress = true;
    updateDisplay(); // Disable buttons

    const wildPokemon = gameState.currentWildPokemon;
    const currentRouteData = routes[gameState.currentRoute];

    if (!currentRouteData) {
        console.error("Battle error: Current route data not found. Money multiplier might be incorrect.");
        // Fallback or error handling could be added here
    }

    let firstAttacker, secondAttacker;
    let firstIsPlayer;

    // Determine attack order
    if (playerPokemon.speed >= wildPokemon.speed) { // Player goes first or on tie
        firstAttacker = playerPokemon;
        secondAttacker = wildPokemon;
        firstIsPlayer = true;
    } else { // Wild Pokemon goes first
        firstAttacker = wildPokemon;
        secondAttacker = playerPokemon;
        firstIsPlayer = false;
    }

    addBattleLog(`${firstAttacker.name} attacks first!`);
    await new Promise(resolve => setTimeout(resolve, 300)); // Short pause

    // First attacker's turn
    const damageByFirst = calculateDamage(firstAttacker, secondAttacker);
    const secondAttackerFainted = secondAttacker.takeDamage(damageByFirst);
    addBattleLog(`${firstAttacker.name} deals ${damageByFirst} damage to ${secondAttacker.name}!`);
    updateDisplay(); // Update HP bars immediately after damage

    if (secondAttackerFainted) {
        await handleFaint(secondAttacker, firstAttacker, !firstIsPlayer, currentRouteData);
        gameState.battleInProgress = false;        // Check if the battle should end
        if (!firstIsPlayer) { // Wild Pokemon (firstAttacker) attacked, and Player's Pokemon (secondAttacker) fainted
            playerPokemon = getActivePokemon(); // Re-fetch active Pokemon, could be null or switched
            if (!playerPokemon || playerPokemon.currentHp <= 0) { // All player Pokemon have fainted
                gameState.battleInProgress = false; // Battle ends
                updateDisplay(); // Update display to show fainted state and battle ended
                if (gameState.currentRoute !== null) {
                    leaveCurrentRoute(); // This will also update display and handle auto-fight
                }
                return; // Exit battle function
            }
        } else { // Player's Pokemon (firstAttacker) attacked, and Wild Pokemon (secondAttacker) fainted
            gameState.battleInProgress = false; // Battle ends as wild Pokemon fainted
            updateDisplay();
            return; // Exit battle function
        }
    }
    // Note: gameState.battleInProgress might have been set to false above if battle ended.
    // If not, it remains true for the second attacker's turn.

    // Second attacker's turn (if they are still able to fight and the first attacker also didn't faint if it was wild)
    if (secondAttacker.currentHp > 0 && firstAttacker.currentHp > 0) {
        addBattleLog(`${secondAttacker.name} attacks!`);
        await new Promise(resolve => setTimeout(resolve, 300)); // Short pause
        const damageBySecond = calculateDamage(secondAttacker, firstAttacker);
        const firstAttackerFainted = firstAttacker.takeDamage(damageBySecond);
        addBattleLog(`${secondAttacker.name} deals ${damageBySecond} damage to ${firstAttacker.name}!`);
        updateDisplay(); // Update HP bars immediately after damage

        if (firstAttackerFainted) {
            await handleFaint(firstAttacker, secondAttacker, firstIsPlayer, currentRouteData);
            // Check if the battle should end
            if (firstIsPlayer) { // Player's Pokemon (firstAttacker) attacked, then got hit back and fainted
                playerPokemon = getActivePokemon(); // Re-fetch active Pokemon
                if (!playerPokemon || playerPokemon.currentHp <= 0) { // All player Pokemon have fainted
                    gameState.battleInProgress = false; // Battle ends
                    updateDisplay(); // Update display to show fainted state and battle ended
                    if (gameState.currentRoute !== null) {
                        leaveCurrentRoute(); // This will also update display and handle auto-fight
                    }
                    return; // Exit battle function
                }
            } else { // Player (secondAttacker) attacked and Wild Pokemon (firstAttacker) fainted.
                gameState.battleInProgress = false; // Battle ends as wild Pokemon fainted
                updateDisplay();
                return; // Exit battle function
            }
        }
    }

    gameState.battleInProgress = false;
    updateDisplay();
}

// Helper to calculate damage
function calculateDamage(attacker, _defender) { // _defender is not used in original formula beyond its defense in takeDamage
    let baseMultiplier, randomMultiplier;
    // Check if the attacker is the player's currently active Pokemon by comparing IDs
    if (getActivePokemon() && attacker.id === getActivePokemon().id) {
        baseMultiplier = 0.3; // Player's base damage multiplier part
        randomMultiplier = 0.5; // Player's random damage multiplier part
    } else { // Attacker is the wild Pokemon
        baseMultiplier = 0.2; // Wild's base damage multiplier part
        randomMultiplier = 0.4; // Wild's random damage multiplier part
    }
    return Math.floor(Math.random() * attacker.attack * randomMultiplier) + Math.floor(attacker.attack * baseMultiplier);
}

function getActivePokemon() {
    return gameState.party[gameState.activePokemonIndex];
}

function findNextHealthyPokemon() {
    return gameState.party.find(p => p && p.currentHp > 0);
}
// Helper function to format numbers with dots as thousands separators
function formatNumberWithDots(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
// Helper function to handle fainting logic
async function handleFaint(faintedPokemon, victorPokemon, faintedWasPlayerPokemon, currentRouteData) {
    addBattleLog(`${faintedPokemon.name} fainted!`);
    updateDisplay(); // Show fainted state immediately
    await new Promise(resolve => setTimeout(resolve, 1200)); // Pause to show fainted Pokemon

    if (faintedWasPlayerPokemon) {
        const nextPokemon = findNextHealthyPokemon();
        if (nextPokemon) {
            gameState.activePokemonIndex = gameState.party.indexOf(nextPokemon);
            addBattleLog(`Go, ${nextPokemon.name}!`);
            // updateDisplay(); // Main battle loop will call updateDisplay
        } else {
            addBattleLog("All your Pokemon fainted!");
            if (gameState.autoBattleActive) { // Stop auto-fight if all Pokemon fainted
                gameState.autoBattleActive = false;
                if (autoFightIntervalId) clearInterval(autoFightIntervalId);
                autoFightIntervalId = null;
                addBattleLog("Auto-Fight stopped: No healthy Pokemon available!");
            }
        }
    } else { // Wild Pokemon fainted
        const expGained = faintedPokemon.level * 15;
        const moneyGained = Math.floor(faintedPokemon.level * (currentRouteData ? currentRouteData.moneyMultiplier : 1) * 3);
        victorPokemon.gainExp(expGained); // victorPokemon is the player's Pokemon
        gameState.money += moneyGained;
        gameState.battleWins++;
        if (!gameState.autoFightUnlocked && gameState.battleWins >= AUTO_FIGHT_UNLOCK_WINS) {
            gameState.autoFightUnlocked = true; addBattleLog("Auto-Fight Unlocked!");
        }
        addBattleLog(`Gained ${expGained} EXP and ${formatNumberWithDots(moneyGained)}₽!`);

        // XP Share distribution
        if (gameState.xpShareLevel > 0 && gameState.xpShareLevel <= XP_SHARE_CONFIG.length) {
            const currentXpShare = XP_SHARE_CONFIG[gameState.xpShareLevel - 1];
            const sharedExpAmount = Math.floor(expGained * currentXpShare.percentage);
            if (sharedExpAmount > 0) {
                let sharedCount = 0;
                gameState.party.forEach(p => {
                    if (p && p.id !== victorPokemon.id && p.currentHp > 0) {
                        p.gainExp(sharedExpAmount);
                        sharedCount++;
                    }
                });
                if (sharedCount > 0) {
                    addBattleLog(`XP Share distributed ${sharedExpAmount} EXP to ${sharedCount} other Pokémon!`);
                }
            }
        }
        gameState.currentWildPokemon = null;
    }
}

function attemptCatch(ballId = 'pokeball') { // Default to pokeball if no ID passed
    if (!gameState.currentWildPokemon) {
        addBattleLog("No wild Pokemon to catch!");
        return;
    }
    // This check is mostly handled by button disabling in updateDisplay, but good for direct calls
    // if (gameState.currentWildPokemon.currentHp <= 0) {
    //     addBattleLog(`Cannot catch ${gameState.currentWildPokemon.name}, it has fainted!`);
    //     return;
    // }
    // if (!gameState.pokeballs[ballId] || gameState.pokeballs[ballId] <= 0) {
    //     addBattleLog(`No ${pokeballData[ballId] ? pokeballData[ballId].name : 'Poké Balls'} left!`);
    //     return;
    // }

    gameState.battleInProgress = true; // Prevent other actions during catch attempt
    updateDisplay(); // Visually disable buttons

    gameState.pokeballs[ballId]--; // Correctly decrement the specific ball type
    const ballUsed = pokeballData[ballId] || pokeballData.pokeball; // Fallback to pokeball if ID is weird
    addBattleLog(`Used 1 ${ballUsed.name} on ${gameState.currentWildPokemon.name}...`);
    
    const wildPokemon = gameState.currentWildPokemon;
    const playerPokemon = getActivePokemon();

    // Catch rate calculation
    const baseCatchRate = 0.25; // Base chance for an "average" Pokemon
    // Health multiplier: more bonus for lower HP. Ranges roughly from 1x (full HP) to 2.5x (very low HP)
    const healthMultiplier = 1 + (((wildPokemon.maxHp - wildPokemon.currentHp) / wildPokemon.maxHp) * 1.5);
    // Level penalty: harder to catch higher level Pokemon. Max penalty around 50% reduction for very high levels.
    const levelPenalty = Math.max(0.2, 1 - (wildPokemon.level / 75)); // Adjust 75 to scale difficulty

    let catchChance = baseCatchRate * healthMultiplier * levelPenalty * ballUsed.modifier;
    catchChance = Math.max(0.05, Math.min(catchChance, 0.95)); // Clamp chance between 5% and 95%

    addBattleLog(`Calculated catch chance: ${(catchChance * 100).toFixed(1)}%`);

    // Simulate a short delay for the "shake"
    setTimeout(async () => { // Make the setTimeout callback async
        if (Math.random() < catchChance) {
            // Successful catch!
            const caughtPokemon = new Pokemon(wildPokemon.name, wildPokemon.level, wildPokemon.isShiny, ballId);
            caughtPokemon.currentHp = wildPokemon.currentHp; // Keep its current HP from battle
            // caughtPokemon.heal(); // Or heal it fully upon catch

            const emptySlot = gameState.party.findIndex(slot => slot === null);
            if (emptySlot !== -1) {
                gameState.party[emptySlot] = caughtPokemon;
                addBattleLog(`${wildPokemon.name} was added to your party!`);
            } else {
                gameState.allPokemon.push(caughtPokemon);
                addBattleLog(`${wildPokemon.name} was sent to your PC (party is full).`);
            }
            gameState.currentWildPokemon = null; // Pokemon is caught, no longer wild
            // Player needs to "Find Pokemon" again.
        } else {
            // Failed catch
            addBattleLog(`${wildPokemon.name} broke free!`);
            // Wild Pokemon attacks back if player has a Pokemon and wild is still able to fight
            if (playerPokemon && playerPokemon.currentHp > 0 && wildPokemon.currentHp > 0) {
                addBattleLog(`${wildPokemon.name} attacks!`);
                const wildDamage = Math.floor(Math.random() * wildPokemon.attack * 0.4) + Math.floor(wildPokemon.attack * 0.2);
                const playerDefeated = playerPokemon.takeDamage(wildDamage);
                addBattleLog(`${wildPokemon.name} deals ${wildDamage} damage to ${playerPokemon.name}!`);
                if (playerDefeated) {
                    updateDisplay(); // Show player Pokemon HP at 0
                    await new Promise(resolve => setTimeout(resolve, 1200)); // Pause
                    addBattleLog(`${playerPokemon.name} fainted!`);
                    const nextPokemon = findNextHealthyPokemon();
                    if (nextPokemon) {
                        gameState.activePokemonIndex = gameState.party.indexOf(nextPokemon);
                        addBattleLog(`Go, ${nextPokemon.name}!`);
                    }
                }
            }
        }
        gameState.battleInProgress = false; // Allow next action/auto-battle
        updateDisplay(); // Re-enable buttons if appropriate, update Pokeball count
    }, 500); // 0.5s delay for catch attempt "animation"
}
function toggleAutoFight() {
    if (!gameState.autoFightUnlocked) {
        addBattleLog("Auto-Fight is still locked. Win more battles!");
        return;
    }
    if (gameState.battleInProgress) {
        addBattleLog("Cannot change Auto-Fight mode during a battle action.");
        return;
    }
    if (!gameState.autoBattleActive && gameState.currentRoute === null) { // Trying to turn ON
        addBattleLog("Cannot start Auto-Fight: No route selected.");
        // gameState.autoBattleActive will remain false
        updateDisplay(); // Ensure button text is correct
        return;
    }

    gameState.autoBattleActive = !gameState.autoBattleActive;
    if (gameState.autoBattleActive) {
        addBattleLog("Auto-Fight Started!");
        if (autoFightIntervalId) clearInterval(autoFightIntervalId);
        autoFightIntervalId = setInterval(autoBattleTick, 1000); // Adjust tick rate as needed (e.g., 2.5 seconds)
        autoBattleTick(); // Run one tick immediately
    } else {
        addBattleLog("Auto-Fight Stopped!");
        if (autoFightIntervalId) {
            clearInterval(autoFightIntervalId);
            autoFightIntervalId = null;
        }
    }
    updateDisplay();
}

async function autoBattleTick() {
    if (!gameState.autoBattleActive || gameState.battleInProgress || gameState.currentRoute === null) {
        return;
    }

    let playerPokemon = getActivePokemon();

    if (!playerPokemon || playerPokemon.currentHp <= 0) {
        const nextPokemon = findNextHealthyPokemon();
        if (nextPokemon) {
            gameState.activePokemonIndex = gameState.party.indexOf(nextPokemon);
            playerPokemon = nextPokemon;
            addBattleLog(`Auto-Switch: Go, ${playerPokemon.name}!`);
            updateDisplay();
        } else {
            addBattleLog("All your Pokémon have fainted!"); 
            
            if (gameState.currentRoute !== null) {
                // leaveCurrentRoute will call toggleAutoFight if autoBattleActive is true.
                // toggleAutoFight will log "Auto-Fight Stopped!" and clear the interval.
                leaveCurrentRoute(); 
            } else {
                // If not on a route (edge case), but auto-fight was on and all fainted.
                if (gameState.autoBattleActive) { // Check if it's actually on
                    toggleAutoFight(); // This will log "Auto-Fight Stopped!" and clear interval.
                }
            }
            // updateDisplay(); // Handled by leaveCurrentRoute or toggleAutoFight
            return; // Exit the tick
        }
    }

    if (!gameState.currentWildPokemon) {
        spawnWildPokemon();
        if (gameState.currentWildPokemon) {
            addBattleLog(`Auto-Fight: A wild ${gameState.currentWildPokemon.name} appeared!`);
            updateDisplay(); // Show the new Pokemon
        } else {
            // spawnWildPokemon already logs if no Pokemon on route
            updateDisplay(); // Ensure UI is consistent
            return; // Wait for next tick if no Pokemon spawned
        }
    }

    if (gameState.currentWildPokemon && playerPokemon && playerPokemon.currentHp > 0) {
        await battle(); // battle() is async and handles battleInProgress & updateDisplay
    }
}
function addToParty(pokemonIndex, partySlot) {
    const pokemonToMove = gameState.allPokemon[pokemonIndex];
    if (gameState.party[partySlot] !== null) {
        // Swap pokemon back to storage
        if (!gameState.allPokemon.includes(gameState.party[partySlot])) {
             gameState.allPokemon.unshift(gameState.party[partySlot]); // Add to beginning of storage
        }
    }

    gameState.party[partySlot] = gameState.allPokemon[pokemonIndex];
    // Remove from storage to avoid duplicates
    gameState.allPokemon.splice(pokemonIndex, 1);

    // If party was empty and this is the first Pokemon, make it active
    if (getActivePokemon() === null && pokemonToMove) {
        gameState.activePokemonIndex = partySlot;
    }

    populateRouteSelector(); // Average level might change
    updateDisplay();
}

function removeFromParty(partySlot) {
    if (gameState.party[partySlot]) {
        gameState.allPokemon.push(gameState.party[partySlot]);
        gameState.party[partySlot] = null;

        // If we removed the active pokemon, find a new one
        if (gameState.activePokemonIndex === partySlot) {
            const nextHealthy = gameState.party.findIndex(p => p && p.currentHp > 0);
            gameState.activePokemonIndex = nextHealthy !== -1 ? nextHealthy : 0;
        }
        populateRouteSelector(); // Average level might change
        updateDisplay();
    }
}

function buyBall(ballId, amount = 1) {
    const ballType = pokeballData[ballId];
    if (!ballType) {
        addBattleLog("Invalid item selected.");
        return;
    }

    let cost;
    // Check for the special 10-pack price for standard Poké Balls
    if (ballId === 'pokeball' && amount === 10 && ballType.cost10) {
        cost = ballType.cost10;
    } else {
        cost = ballType.cost * amount;
    }

    if (gameState.money >= cost) {
        gameState.money -= cost;
        gameState.pokeballs[ballId] = (gameState.pokeballs[ballId] || 0) + amount;
        updateDisplay();
        addBattleLog(`Bought ${amount} ${ballType.name}${amount > 1 ? 's' : ''} for ${formatNumberWithDots(cost)}₽!`);
    } else {
        addBattleLog(`Not enough money for ${amount} ${ballType.name}${amount > 1 ? 's' : ''}. Needs ${formatNumberWithDots(cost)}₽.`);
    }
}

function buyXpShareUpgrade() {
    if (gameState.xpShareLevel >= XP_SHARE_CONFIG.length) {
        addBattleLog("XP Share is already at max level!");
        return;
    }

    const nextLevelIndex = gameState.xpShareLevel; // Current level is 0, next is config[0]
    const upgradeCost = XP_SHARE_CONFIG[nextLevelIndex].cost;
    const upgradeName = XP_SHARE_CONFIG[nextLevelIndex].name;

    if (gameState.money >= upgradeCost) {
        gameState.money -= upgradeCost;
        gameState.xpShareLevel++;
        addBattleLog(`Successfully purchased ${upgradeName} for ${formatNumberWithDots(upgradeCost)}₽!`);
        updateDisplay();
        saveGame();
    } else {
        addBattleLog(`Not enough money to buy ${upgradeName}. Needs ${formatNumberWithDots(upgradeCost)}₽.`);
    }
}

function buyPotion(potionId, quantity = 1) {
    const potionInfo = potionData[potionId];
    if (!potionInfo) {
        addBattleLog("Invalid item selected.");
        return;
    }

    const cost = potionInfo.cost * quantity;

    if (gameState.money >= cost) {
        gameState.money -= cost;
        gameState.potions[potionId] = (gameState.potions[potionId] || 0) + quantity;
        updateDisplay();
        addBattleLog(`Bought ${quantity} ${potionInfo.name}${quantity > 1 ? 's' : ''} for ${formatNumberWithDots(cost)}₽!`);
    } else {
        addBattleLog(`Not enough money for ${quantity} ${potionInfo.name}${quantity > 1 ? 's' : ''}. Needs ${formatNumberWithDots(cost)}₽.`);
    }
}

function usePotion(potionId) {
    const potionInfo = potionData[potionId];
    if (!potionInfo) {
        addBattleLog("Invalid potion type.");
        return;
    }

    if (!gameState.potions[potionId] || gameState.potions[potionId] <= 0) {
        addBattleLog(`No ${potionInfo.name}s left!`);
        return;
    }

    let healedSomething = false;
    const activePokemon = getActivePokemon();

    if (potionInfo.effectType === 'active_pokemon_percentage' && activePokemon) {
        if (activePokemon.currentHp > 0 && activePokemon.currentHp < activePokemon.maxHp) {
            activePokemon.healPartial(potionInfo.effectValue);
            addBattleLog(`${activePokemon.name} was healed by the ${potionInfo.name}!`);
            healedSomething = true;
        } else if (activePokemon.currentHp === activePokemon.maxHp) {
            addBattleLog(`${activePokemon.name} is already at full HP. Potion not used.`);
        } else {
            addBattleLog(`${activePokemon.name} has fainted and cannot be healed by this potion.`);
        }
    } else if (potionInfo.effectType === 'active_pokemon_full' && activePokemon) {
        if (activePokemon.currentHp > 0 && activePokemon.currentHp < activePokemon.maxHp) {
            activePokemon.heal();
            addBattleLog(`${activePokemon.name} was fully healed by the ${potionInfo.name}!`);
            healedSomething = true;
        } else if (activePokemon.currentHp === activePokemon.maxHp) {
            addBattleLog(`${activePokemon.name} is already at full HP. Potion not used.`);
        } else {
            addBattleLog(`${activePokemon.name} has fainted and cannot be healed by this potion.`);
        }
    } else if (potionInfo.effectType === 'party_full') {
        let anyPartyMemberHealed = false;
        gameState.party.forEach(pokemon => {
            if (pokemon && pokemon.currentHp > 0 && pokemon.currentHp < pokemon.maxHp) {
                pokemon.heal();
                anyPartyMemberHealed = true;
            }
        });
        if (anyPartyMemberHealed) {
            addBattleLog(`The party was healed by the ${potionInfo.name}!`);
            healedSomething = true; 
        } else {
            addBattleLog(`No Pokémon in the party needed healing. ${potionInfo.name} not used.`);
        }
    }


    if (healedSomething) {
        gameState.potions[potionId]--;
    }
    updateDisplay();
}
// --- Utility functions for Pokémon data presentation ---
function getPokemonNameHTML(pokemon, shinyIndicatorClass = 'shiny-indicator', showBallIcon = false) {
    if (!pokemon) return '';
    let ballIconHTML = '';
    if (showBallIcon) {
        const ballId = pokemon.caughtWithBall || 'pokeball';
        const ballInfo = pokeballData[ballId] || pokeballData.pokeball; // Use pokeballData
        ballIconHTML = `<img src="${ballInfo.image}" alt="${ballInfo.name}" title="${ballInfo.name}" class="inline-ball-icon"> `;
    }
    const shinySpan = pokemon.isShiny ? ` <span class="${shinyIndicatorClass}">(Shiny)</span>` : '';
    return `${ballIconHTML}${pokemon.name}${shinySpan}`;}

function getPokemonSpritePath(pokemon, spriteType = 'front', baseSpriteUrl = POKEMON_SPRITE_BASE_URL) {
    if (!pokemon || !pokemon.pokedexId) return "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="; // Placeholder
    return `${baseSpriteUrl}${spriteType}/${pokemon.isShiny ? 'shiny/' : ''}${pokemon.pokedexId}.png`;
}

function getPokemonLevelText(pokemon) { // Used for player/wild display (e.g., :L5)
    if (!pokemon || typeof pokemon.level === 'undefined') return '';
    return `:L${pokemon.level}`;
}

function getPokemonFullLevelText(pokemon) { // Used for party/storage display (e.g., Lv.5)
    if (!pokemon || typeof pokemon.level === 'undefined') return '';
    return `Lv.${pokemon.level}`;
}

function getPokemonHpText(pokemon) {
    if (!pokemon) return 'HP: 0/0';
    return `HP: ${pokemon.currentHp}/${pokemon.maxHp}`;
}

function getPokemonStatsString(pokemon) { // For player/wild display
    if (!pokemon) return 'ATK: 0 | DEF: 0 | SPD: 0';
    return `ATK: ${pokemon.attack} | DEF: ${pokemon.defense} | SPD: ${pokemon.speed}`;
}

function getPokemonDetailedStatsHTML(pokemon) { // For party/storage display
    if (!pokemon) return '';
    return `
        <div class="pokemon-detailed-stats">HP: ${pokemon.currentHp}/${pokemon.maxHp} | SPD: ${pokemon.speed}</div>
        <div class="pokemon-detailed-stats">ATK: ${pokemon.attack} | DEF: ${pokemon.defense} </div>
    `;
}

function getPokemonExpBarHTML(pokemon) {
    if (!pokemon || typeof pokemon.exp !== 'number' || typeof pokemon.expToNext !== 'number' || pokemon.expToNext === 0) {
        return '<div class="pokemon-exp" style="height: 8px; margin: 5px 0;"><div class="exp-fill" style="width: 0%"></div></div>';
    }
    const expPercentage = (pokemon.exp / pokemon.expToNext) * 100;
    return `<div class="pokemon-exp" style="height: 8px; margin: 5px 0;"><div class="exp-fill" style="width: ${expPercentage}%"></div></div>`;
}
// --- End of utility functions ---

function updateDisplay() {
    // Update stats
    document.getElementById('money').textContent = formatNumberWithDots(gameState.money) + "₽";
    document.getElementById('pokeballs-standard').textContent = gameState.pokeballs.pokeball;
    document.getElementById('pokeballs-great').textContent = gameState.pokeballs.greatball;
    document.getElementById('pokeballs-ultra').textContent = gameState.pokeballs.ultraball;
    // Update potion counts (You'll need to add HTML elements with these IDs to display them)
    if (document.getElementById('potions-potion')) document.getElementById('potions-potion').textContent = gameState.potions.potion;
    if (document.getElementById('potions-hyperpotion')) document.getElementById('potions-hyperpotion').textContent = gameState.potions.hyperpotion;
    if (document.getElementById('potions-moomoomilk')) document.getElementById('potions-moomoomilk').textContent = gameState.potions.moomoomilk;

    // Calculate Pokedex count (unique species and unique shiny species)
    const uniqueSpecies = new Set();
    const uniqueShinySpecies = new Set();
    const allPlayerPokemon = [...gameState.party.filter(p => p), ...gameState.allPokemon.filter(p => p)];

    allPlayerPokemon.forEach(pokemon => {
        if (pokemon.pokedexId) { // Ensure pokedexId exists
            uniqueSpecies.add(pokemon.pokedexId);
            if (pokemon.isShiny) {
                uniqueShinySpecies.add(pokemon.pokedexId);
            }
        }
    });
    let pokedexText = `${uniqueSpecies.size}`;
    if (uniqueShinySpecies.size > 0) {
        pokedexText += ` (${uniqueShinySpecies.size} Shiny)`;
    }
    document.getElementById('pokedex-count').textContent = pokedexText;    document.getElementById('battle-wins').textContent = gameState.battleWins;

    const fightBtn = document.getElementById('fight-btn');
    const catchPokeballBtn = document.getElementById('catch-pokeball-btn');
    const catchGreatballBtn = document.getElementById('catch-greatball-btn');
    const catchUltraballBtn = document.getElementById('catch-ultraball-btn');
    const autoFightBtn = document.getElementById('auto-fight-btn');

    // Get references to route UI elements
    const routeSelectContainer = document.getElementById('route-select-container');
    const leaveRouteBtn = document.getElementById('leave-route-btn');

    const activePokemon = getActivePokemon();
    const playerCanInitiateAction = activePokemon && activePokemon.currentHp > 0;

    // Fight Button & Route UI visibility
    if (gameState.currentRoute === null) {
        fightBtn.textContent = "Select a Route";
        fightBtn.disabled = true;
        if (routeSelectContainer) routeSelectContainer.style.display = ''; // Show selector container
        if (leaveRouteBtn) leaveRouteBtn.style.display = 'none';     // Hide leave button
    } else {
        fightBtn.textContent = gameState.currentWildPokemon ? "Fight!" : "Find Pokémon";
        fightBtn.disabled = gameState.battleInProgress || gameState.autoBattleActive || !playerCanInitiateAction;
        if (routeSelectContainer) routeSelectContainer.style.display = 'none'; // Hide selector container
        if (leaveRouteBtn) {
            leaveRouteBtn.style.display = ''; // Show leave button
            leaveRouteBtn.disabled = gameState.battleInProgress || gameState.autoBattleActive; // Disable if busy
        }
    }

    // Catch Buttons
    const canCatch = gameState.currentWildPokemon && gameState.currentWildPokemon.currentHp > 0 && !gameState.battleInProgress && !gameState.autoBattleActive;
    if (catchPokeballBtn) catchPokeballBtn.disabled = !canCatch || gameState.pokeballs.pokeball <= 0;
    if (catchGreatballBtn) catchGreatballBtn.disabled = !canCatch || gameState.pokeballs.greatball <= 0;
    if (catchUltraballBtn) catchUltraballBtn.disabled = !canCatch || gameState.pokeballs.ultraball <= 0;
    // Ensure pokeballData is loaded before accessing its properties
    if (pokeballData.pokeball && catchPokeballBtn) catchPokeballBtn.textContent = `Catch (${pokeballData.pokeball.name} - ${gameState.pokeballs.pokeball})`;
    if (pokeballData.greatball && catchGreatballBtn) catchGreatballBtn.textContent = `Catch (${pokeballData.greatball.name} - ${gameState.pokeballs.greatball})`;
    if (pokeballData.ultraball && catchUltraballBtn) catchUltraballBtn.textContent = `Catch (${pokeballData.ultraball.name} - ${gameState.pokeballs.ultraball})`;


    // Auto-Fight Button
    if (!gameState.autoFightUnlocked) {
        autoFightBtn.textContent = `Auto-Fight (LOCKED - ${AUTO_FIGHT_UNLOCK_WINS} wins)`;
        autoFightBtn.disabled = true;
        autoFightBtn.style.backgroundColor = "#aaa"; // Greyed out when locked
    } else {
        autoFightBtn.textContent = gameState.autoBattleActive ? "Stop Auto-Fight" : "Start Auto-Fight";
        // Disable if battle in progress OR if trying to start but no route selected
        autoFightBtn.disabled = gameState.battleInProgress || (!gameState.autoBattleActive && gameState.currentRoute === null);
        autoFightBtn.style.backgroundColor = gameState.autoBattleActive ? "#e74c3c" : "#4CAF50"; // Red for Stop, Green for Start
    }

    // Removed Heal All button logic as the button itself was removed from HTML.

    // Update XP Share Button
    const xpShareShopItemEl = document.getElementById('exp-share-shop-item');
    const xpShareTooltipEl = document.getElementById('tooltip-exp-share-shop-item');
    if (xpShareShopItemEl && xpShareTooltipEl) {
        const xpShareButton = document.getElementById('exp-share-buy-btn');
        if (gameState.xpShareLevel >= XP_SHARE_CONFIG.length) {
            if (xpShareButton) {
                xpShareButton.textContent = "XP Share (Max Level)";
                xpShareButton.disabled = true;
            }
            xpShareTooltipEl.textContent = "XP Share is at its maximum level.";
        } else {
            const nextLevelConfig = XP_SHARE_CONFIG[gameState.xpShareLevel];
            if (xpShareButton) {
                xpShareButton.textContent = `Buy ${nextLevelConfig.name} - ${formatNumberWithDots(nextLevelConfig.cost)}₽`;
                xpShareButton.disabled = false;
            }
            xpShareTooltipEl.textContent = `${nextLevelConfig.name}: Increases EXP gained by benched Pokémon by ${nextLevelConfig.percentage * 100}%.`;
        }
    }

    // Update Shop Item Custom Tooltips, Prices, and Buy Button Texts
    for (const ballId in pokeballData) {
        const ballInfo = pokeballData[ballId];
        const shopItemEl = document.getElementById(`shop-item-${ballId}`);

        if (shopItemEl && ballInfo) {
            // Update item name (e.g., "Pokeball (x1)")
            const nameSpan = shopItemEl.querySelector('span'); // Assumes it's the first span for the name
            if (nameSpan) {
                nameSpan.textContent = `${ballInfo.name} (x1)`;
            }

            // Update buy button text with price (e.g., "Buy - 10G")
            const buyButton = shopItemEl.querySelector(`button[onclick="buyBall('${ballId}', 1)"]`);
            if (buyButton && typeof ballInfo.cost === 'number') {
                buyButton.textContent = `Buy - ${formatNumberWithDots(ballInfo.cost)}₽`;
            }

            // Update tooltip
            const tooltipEl = document.getElementById(`tooltip-shop-item-${ballId}`);
            if (tooltipEl) {
                tooltipEl.textContent = ballInfo.description || ballInfo.name;
            }
        }
    }
    for (const potionId in potionData) {
        const potionInfo = potionData[potionId];
        const shopItemEl = document.getElementById(`shop-item-${potionId}`);

        if (shopItemEl && potionInfo) {
            // Update item name (e.g., "Potion (x1)")
            const nameSpan = shopItemEl.querySelector('span'); // Assumes it's the first span for the name
            if (nameSpan) {
                nameSpan.textContent = `${potionInfo.name} (x1)`;
            }

            // Update buy button text with price (e.g., "Buy - 20G")
            const buyButton = shopItemEl.querySelector(`button[onclick="buyPotion('${potionId}', 1)"]`);
            if (buyButton && typeof potionInfo.cost === 'number') {
                buyButton.textContent = `Buy - ${formatNumberWithDots(potionInfo.cost)}₽`;
            }

            // Update tooltip
            const tooltipEl = document.getElementById(`tooltip-shop-item-${potionId}`);
            if (tooltipEl) {
                tooltipEl.textContent = potionInfo.description || potionInfo.name;
            }
        }
    }

    // Update Item Bar Custom Tooltips
    const itemDisplayElements = document.querySelectorAll('.items-bar .item-display');
    itemDisplayElements.forEach(itemEl => {
        // The 'title' attribute on item-display is now just for semantic fallback or if JS fails.
        // We'll use specific IDs for the tooltips for clarity.
        let description = '';
        let tooltipEl = null;

        // Poké Balls
        if (itemEl.querySelector('#pokeballs-standard')) { // Check if it's the pokeball display
            tooltipEl = document.getElementById('tooltip-itembar-pokeball');
            if (pokeballData.pokeball) description = pokeballData.pokeball.description || pokeballData.pokeball.name;
        } else if (itemEl.querySelector('#pokeballs-great')) {
            tooltipEl = document.getElementById('tooltip-itembar-greatball');
            if (pokeballData.greatball) description = pokeballData.greatball.description || pokeballData.greatball.name;
        } else if (itemEl.querySelector('#pokeballs-ultra')) {
            tooltipEl = document.getElementById('tooltip-itembar-ultraball');
            if (pokeballData.ultraball) description = pokeballData.ultraball.description || pokeballData.ultraball.name;
        // Potions
        } else if (itemEl.querySelector('#potions-potion')) {
            tooltipEl = document.getElementById('tooltip-itembar-potion');
            if (potionData.potion) description = potionData.potion.description || potionData.potion.name;
        } else if (itemEl.querySelector('#potions-hyperpotion')) {
            tooltipEl = document.getElementById('tooltip-itembar-hyperpotion');
            if (potionData.hyperpotion) description = potionData.hyperpotion.description || potionData.hyperpotion.name;
        } else if (itemEl.querySelector('#potions-moomoomilk')) {
            tooltipEl = document.getElementById('tooltip-itembar-moomoomilk');
            if (potionData.moomoomilk) description = potionData.moomoomilk.description || potionData.moomoomilk.name;
        }

        if (tooltipEl && description) {
            tooltipEl.textContent = description;
        }
    });


    // Potion Use Buttons
    const usePotionBtn = document.getElementById('use-potion-btn');
    const useHyperPotionBtn = document.getElementById('use-hyperpotion-btn');
    const useMoomooMilkBtn = document.getElementById('use-moomoomilk-btn');

    const canUseItem = !gameState.battleInProgress; // General condition for using items from this UI

    if (usePotionBtn) {
        const activePokemonNeedsPotion = activePokemon && activePokemon.currentHp > 0 && activePokemon.currentHp < activePokemon.maxHp;
        usePotionBtn.disabled = !canUseItem || !activePokemonNeedsPotion || gameState.potions.potion <= 0;
        usePotionBtn.textContent = `Use Potion (${gameState.potions.potion})`;
    }
    if (useHyperPotionBtn) {
        const activePokemonNeedsHyperPotion = activePokemon && activePokemon.currentHp > 0 && activePokemon.currentHp < activePokemon.maxHp;
        useHyperPotionBtn.disabled = !canUseItem || !activePokemonNeedsHyperPotion || gameState.potions.hyperpotion <= 0;
        useHyperPotionBtn.textContent = `Use Hyper Potion (${gameState.potions.hyperpotion})`;
    }
    if (useMoomooMilkBtn) {
        const partyNeedsHealing = gameState.party.some(p => p && p.currentHp > 0 && p.currentHp < p.maxHp);
        useMoomooMilkBtn.disabled = !canUseItem || !partyNeedsHealing || gameState.potions.moomoomilk <= 0;
        useMoomooMilkBtn.textContent = `Use Moomoo Milk (${gameState.potions.moomoomilk})`;
    }
    // Update player pokemon display using the new helper function
    const playerElements = {
        nameEl: document.getElementById('player-name'),
        levelEl: document.getElementById('player-level'),
        spriteEl: document.getElementById('player-sprite'),
        hpTextEl: document.getElementById('player-hp-text'),
        hpBarId: 'player-hp',
        statsEl: document.getElementById('player-stats'),
        defaultName: 'No Pokemon',
        defaultAlt: 'No active Pokemon'
        // shinyIndicatorClass is defaulted in getPokemonNameHTML
    };
    displayPokemonData(activePokemon, playerElements, 'back');

    updateWildPokemonDisplay();
    updatePartyDisplay();
    // populateRouteSelector(); // Called by specific actions that change avg level or route
    updateStorageDisplay();
}

function displayPokemonData(pokemon, elements, spriteType = 'front') {
    // elements = { nameEl, levelEl, spriteEl, hpTextEl, hpBarId, statsEl, defaultName, defaultAlt, shinyIndicatorClass (optional) }
    if (pokemon) {
        elements.nameEl.innerHTML = getPokemonNameHTML(pokemon, elements.shinyIndicatorClass, false); // Never show ball icon in battle display
        if (elements.levelEl) elements.levelEl.textContent = getPokemonLevelText(pokemon);

        elements.spriteEl.src = getPokemonSpritePath(pokemon, spriteType);
        elements.spriteEl.alt = pokemon.name;

        if (elements.hpTextEl) elements.hpTextEl.textContent = getPokemonHpText(pokemon);
        if (elements.statsEl) elements.statsEl.textContent = getPokemonStatsString(pokemon);
        if (elements.hpBarId) updateHpBar(elements.hpBarId, pokemon.currentHp, pokemon.maxHp);

        if (pokemon.isShiny) elements.spriteEl.classList.add('shiny-pokemon');
        else elements.spriteEl.classList.remove('shiny-pokemon');
    } else {
        elements.nameEl.innerHTML = elements.defaultName || 'No Pokemon';
        if (elements.levelEl) elements.levelEl.textContent = '';
        elements.spriteEl.src = getPokemonSpritePath(null); // Gets placeholder
        elements.spriteEl.alt = elements.defaultAlt || "No Pokemon";
        if (elements.hpTextEl) elements.hpTextEl.textContent = getPokemonHpText(null);
        if (elements.statsEl) elements.statsEl.textContent = getPokemonStatsString(null);
        if (elements.hpBarId) updateHpBar(elements.hpBarId, 0, 1);
        elements.spriteEl.classList.remove('shiny-pokemon');
    }
}

function updateWildPokemonDisplay() {
    const wildPokemonContainer = document.getElementById('wild-pokemon');
    const wildPokemonInfoDiv = wildPokemonContainer.querySelector('.pokemon-info'); // Get the info div
    const wildSprite = document.getElementById('wild-sprite');

    // Ensure the main container itself is always displayed as per CSS (e.g., block, flex)
    // and its own visibility is 'visible'. We will control the visibility of its children.
    wildPokemonContainer.style.display = ''; // Resets from 'none' if it was ever set
    wildPokemonContainer.style.visibility = 'visible';

    const wildElements = {
        nameEl: document.getElementById('wild-name'),
        levelEl: document.getElementById('wild-level'),
        spriteEl: wildSprite,
        hpTextEl: document.getElementById('wild-hp-text'),
        hpBarId: 'wild-hp',
        statsEl: document.getElementById('wild-stats'),
        // defaultName/defaultAlt not strictly needed here due to visibility toggling,
        // but displayPokemonData(null,...) will clear them anyway.
    };

    if (gameState.currentWildPokemon) {
        if (wildPokemonInfoDiv) wildPokemonInfoDiv.style.visibility = 'visible'; // Make info div visible
        wildSprite.style.visibility = 'visible';           // Make sprite visible
        displayPokemonData(gameState.currentWildPokemon, wildElements, 'front');
    } else {
        if (wildPokemonInfoDiv) wildPokemonInfoDiv.style.visibility = 'hidden'; // Hide info div
        wildSprite.style.visibility = 'hidden';          // Hide sprite
        displayPokemonData(null, wildElements, 'front'); // Clear content using the helper
    }
}

function generatePokemonListItemHTML(pokemon, index, locationType) {
    // locationType: 'party' or 'storage'
    if (!pokemon) {
        if (locationType === 'party') return '<div style="color: #ccc;">Empty Slot</div>';
        return ''; // Should not happen for storage if list is filtered properly before map
    }

    const shinyClass = pokemon.isShiny ? 'shiny-pokemon' : '';
    const spritePath = getPokemonSpritePath(pokemon, 'front'); // Party/storage always use front sprites
    // const ballId = pokemon.caughtWithBall || 'pokeball'; // Default to pokeball if undefined - Handled by getPokemonNameHTML
    // const ballInfo = pokeballData[ballId] || pokeballData.pokeball; // Fallback for safety - Handled by getPokemonNameHTML

    let evolveButtonHtml = '';
    if (pokemon.evolutionTargetName && pokemon.evolveLevel && pokemon.level >= pokemon.evolveLevel) {
        const onclickAction = locationType === 'party' ? `attemptEvolution(${index}, 'party')` : `event.stopPropagation(); attemptEvolution(${index}, 'storage')`;
        evolveButtonHtml = `<button class="btn small" onclick="${onclickAction}" style="background: #ffc107; color: #333; margin-left: 5px;">Evolve</button>`;
    }

    let controlsHtml = '';
    if (locationType === 'party') {
        const isActive = gameState.activePokemonIndex === index;
        controlsHtml = `
            <div class="controls" style="margin-top: 8px;">
                <button class="btn small ${isActive ? 'secondary' : ''}" 
                        onclick="setActivePokemon(${index})" 
                        ${pokemon.currentHp <= 0 ? 'disabled' : ''}>
                    ${isActive ? 'Active' : 'Select'}
                </button>
                <button class="btn small" onclick="removeFromParty(${index})" style="background: #f44336;">
                    Remove
                </button>
                ${evolveButtonHtml}
            </div>`;
    } else { // storage
        controlsHtml = `
            <div class="controls" style="margin-top: 8px; clear:both;">
                <button class="btn small secondary" onclick="event.stopPropagation(); addToPartyDialog(${index})">
                    Add to Party
                </button>
                <button class="btn small" onclick="event.stopPropagation(); confirmReleasePokemon(${index})" style="background: #dc3545; margin-left: 5px;">
                    Release
                </button>
                ${evolveButtonHtml}
            </div>`;
    }

    const imgStyle = locationType === 'storage' ? 'style="width: 48px; height: 48px; float: left; margin-right: 10px; image-rendering: pixelated;"' : '';

    const cardContent = `
        <img class="pokemon-sprite ${shinyClass}" src="${spritePath}" alt="${pokemon.name}" ${imgStyle}>
        <div class="pokemon-name">${getPokemonNameHTML(pokemon, 'shiny-indicator', locationType === 'party')}</div>
        <div class="pokemon-level">${getPokemonFullLevelText(pokemon)}</div>
        ${getPokemonDetailedStatsHTML(pokemon)}
        ${getPokemonExpBarHTML(pokemon)}
        ${controlsHtml}
    `;

    if (locationType === 'party') {
        return cardContent; // This will be innerHTML of the slot div
    } else { // storage
        return `<div class="pokemon-card">${cardContent}</div>`;
    }
}

function updatePartyDisplay() {
    for (let i = 0; i < 6; i++) { // Changed loop to 6 for party slots
        const slot = document.getElementById(`party-${i}`);
        const pokemon = gameState.party[i];

        if (pokemon) {
            slot.classList.add('filled');
            slot.innerHTML = generatePokemonListItemHTML(pokemon, i, 'party');
        } else {
            slot.classList.remove('filled');
            slot.innerHTML = generatePokemonListItemHTML(null, i, 'party'); // Will render "Empty Slot"
        }
    }
}

function updateStorageDisplay() {
    const storageList = document.getElementById('team-list');

    if (gameState.allPokemon.length === 0) {
        storageList.innerHTML = `
                    <div style="text-align: center; color: #ccc; margin-top: 50px;">
                        No Pokemon in storage!<br>
                        Catch Pokemon to build your collection.
                    </div>
                `;
        return;
    }

    storageList.innerHTML = gameState.allPokemon
        .map((pokemon, index) => generatePokemonListItemHTML(pokemon, index, 'storage'))
        .join('');
}

function setActivePokemon(partyIndex) {
    if (gameState.party[partyIndex] && gameState.party[partyIndex].currentHp > 0) {
        gameState.activePokemonIndex = partyIndex;
        updateDisplay();
        addBattleLog(`${gameState.party[partyIndex].name} is now active!`);
    }
}

function addToPartyDialog(storageIndex) {
    const availableSlots = [];
    for (let i = 0; i < 6; i++) { // Changed loop to 6 for party slots
        if (gameState.party[i] === null) {
            availableSlots.push(i);
        }
    }

    if (availableSlots.length === 0) {
        // Party is full, ask which to replace
        const slotChoice = prompt("Party is full! Which slot to replace? (1-6, or cancel)"); // Updated prompt
        const slot = parseInt(slotChoice) - 1;
        if (slot >= 0 && slot < 6) { // Check against 6 slots
            addToParty(storageIndex, slot);
        }
    } else {
        // Add to first available slot
        addToParty(storageIndex, availableSlots[0]);
    }
}

function attemptEvolution(index, locationType) { // locationType is 'party' or 'storage'
    let pokemonToEvolve;
    if (locationType === 'party') {
        pokemonToEvolve = gameState.party[index];
    } else if (locationType === 'storage') {
        pokemonToEvolve = gameState.allPokemon[index];
    }

    if (pokemonToEvolve) {
        if(pokemonToEvolve.evolve()) {
            updateDisplay();
        }
    }
}

function confirmReleasePokemon(storageIndex) {
    const pokemonToRelease = gameState.allPokemon[storageIndex];
    if (!pokemonToRelease) return;

    // Check if this is the last Pokemon
    const totalPokemonCount = gameState.party.filter(p => p !== null).length + gameState.allPokemon.length;

    if (totalPokemonCount <= 1) {
        alert("You cannot release your last Pokémon!");
        return;
    }

    if (window.confirm(`Are you sure you want to release ${pokemonToRelease.name} (Lv. ${pokemonToRelease.level})? This action cannot be undone.`)) {
        releasePokemon(storageIndex);
    }
}

function releasePokemon(storageIndex) {
    const releasedPokemon = gameState.allPokemon.splice(storageIndex, 1); // Remove and get the released pokemon
    if (releasedPokemon && releasedPokemon.length > 0) {
        addBattleLog(`${releasedPokemon[0].name} has been released.`);
        updateDisplay(); // Update storage, caught count, etc.
        saveGame(); // Save changes
    }
}

function updateHpBar(id, current, max) {
    const percentage = max > 0 ? (current / max) * 100 : 0;
    document.getElementById(id).style.width = percentage + '%';
}

function addBattleLog(message) {
    const log = document.getElementById('battle-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    // Keep only last 8 messages
    while (log.children.length > 8) {
        log.removeChild(log.firstChild);
    }
}
function serializePokemon(p) {
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

function deserializePokemon(savedPkmnData) {
    if (!savedPkmnData) return null;
    // Pass the saved shiny status to the constructor
    const pokemon = new Pokemon(savedPkmnData.name, savedPkmnData.level, savedPkmnData.isShiny, savedPkmnData.caughtWithBall || 'pokeball');
    pokemon.id = savedPkmnData.id || (Date.now() + Math.random()); // Assign new if old save
    pokemon.currentHp = savedPkmnData.currentHp;
    pokemon.exp = savedPkmnData.exp;
    // PokedexId, evolutionTargetName, evolveLevel, baseStats, growthRates are handled by Pokemon constructor and getStatsData
    return pokemon;
}
// Save/Load game
function saveGame() {
    const saveData = {
        money: gameState.money,
        pokeballs: gameState.pokeballs,
        potions: gameState.potions, // Save potions
        party: gameState.party.map(p => serializePokemon(p)),
        allPokemon: gameState.allPokemon.map(p => serializePokemon(p)),
        currentWildPokemon: serializePokemon(gameState.currentWildPokemon),
        battleWins: gameState.battleWins,
        currentRoute: gameState.currentRoute,
        autoBattleActive: gameState.autoBattleActive, // Though it will be reset on load
        autoFightUnlocked: gameState.autoFightUnlocked,
        xpShareLevel: gameState.xpShareLevel
 
    };
    localStorage.setItem('pokemonIdleGameV2', JSON.stringify(saveData));
}

function manualSaveGame() {
    saveGame();
    addBattleLog("Game Saved!");
}

function loadGame() {
    const saveData = localStorage.getItem('pokemonIdleGameV2');
    if (saveData) {
        const data = JSON.parse(saveData);
        gameState.money = data.money || 100;
// Ensure pokeballs is an object and has all types
        gameState.pokeballs = {
            pokeball: (data.pokeballs && data.pokeballs.pokeball !== undefined) ? data.pokeballs.pokeball : 10,
            greatball: (data.pokeballs && data.pokeballs.greatball) || 0,
            ultraball: (data.pokeballs && data.pokeballs.ultraball) || 0,
        };
        gameState.potions = data.potions || { // Load potions, defaulting to 0 for each
            potion: 0,
            hyperpotion: 0,
            moomoomilk: 0,
        };
        gameState.battleWins = data.battleWins || 0;
        gameState.currentRoute = data.currentRoute !== undefined ? data.currentRoute : 1;
        gameState.autoFightUnlocked = data.autoFightUnlocked || false;
        gameState.autoBattleActive = false; // Always start with auto-battle off on load
        gameState.xpShareLevel = data.xpShareLevel || 0;

        // Load party
        if (data.party) {
            gameState.party = data.party.map(pData => pData ? deserializePokemon(pData) : null);
        }
        // Set active Pokemon index based on loaded party
        const firstHealthyInParty = gameState.party.findIndex(p => p && p.currentHp > 0);
        gameState.activePokemonIndex = firstHealthyInParty !== -1 ? firstHealthyInParty : 0;

        // Load storage
        if (data.allPokemon) {
            gameState.allPokemon = data.allPokemon.map(pData => pData ? deserializePokemon(pData) : null);
        }
        // Load current wild Pokemon
        if (data.currentWildPokemon) {
            gameState.currentWildPokemon = data.currentWildPokemon ? deserializePokemon(data.currentWildPokemon) : null;
        } else {
            gameState.currentWildPokemon = null; // Explicitly null if not saved
        }

        // Update route display
        // Ensure routes are loaded before calling changeRoute if it relies on global `routes`
        if (Object.keys(routes).length > 0 && document.getElementById('route-info')) {
            if (gameState.currentRoute !== null) {
                if (routes[gameState.currentRoute]) {
                    document.getElementById('route-info').textContent = routes[gameState.currentRoute].description;
                }
            } else if (document.getElementById('route-info')) {
                document.getElementById('route-info').textContent = "Not currently on a route. Select a route to find Pokémon.";
            }
        }
        // updateDisplay(); // Called by initGame after loadGame
    }
}

function confirmClearSave() {
    if (window.confirm("Are you sure you want to clear all saved data? This action cannot be undone!")) {
        clearSaveData();
    }
}

function clearSaveData() {
    localStorage.removeItem('pokemonIdleGameV2');
    addBattleLog("Save data cleared. Reloading game...");
    setTimeout(() => {
        location.reload();
    }, 1500);
}

// Auto-save every 15 seconds
setInterval(saveGame, 15000);

// Initialize the game when page loads
initGame().then(() => {
    populateRouteSelector(); // Ensure dropdown is populated after all data is ready
});