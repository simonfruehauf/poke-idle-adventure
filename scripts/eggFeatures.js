import { gameState } from './state.js'; 
import { pokemonBaseStatsData, eggData } from './state.js'; 
import { Pokemon } from './pokemon.js';

import { addBattleLog, getActivePokemon} from './utils.js'; 
import { updateDisplay} from './ui.js';

const EGG_GENERATION_TIME = 4 * 60 * 60 * 1000; // 4 hours in ms
let INCUBATION_TIME = 60 * 60 * 1000; // X hour in ms

let eggInterval;
let incubatorInterval;

// Helper to format duration (use from utils.js if available and more robust)
function formatDuration(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

function getElement(id) {
    return document.getElementById(id);
}

export function initializeEggFeatures() {
    if (!gameState.incubator) { // Ensure incubator state is initialized
        gameState.incubator = { eggDetails: null, incubationEndTime: null, isHatchingReady: false };
    }
    if (gameState.eggNextAvailableTimestamp === undefined) gameState.eggNextAvailableTimestamp = null;
    if (gameState.EggIsClaimable === undefined) gameState.EggIsClaimable = false;
    if (gameState.playerHasUnincubatedEgg === undefined) gameState.playerHasUnincubatedEgg = false;

    updateEggUI();
    updateIncubatorUI();
}

// Function to safely get an element
function getElementByIdSafe(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`Element with ID '${id}' not found.`);
    return el;
}

function getRandomHatchablePokemon(type) {
    let chosenPokemonData;
    let hatchablePokemon = [];

    // For a "Mystery Egg", pick a random base-stage Pokémon
    if (type === 'mystery') { 
        const allEvolutionTargets = new Set();
        for (const name in pokemonBaseStatsData) {
            const pkmn = pokemonBaseStatsData[name];
            if (pkmn.evolution) {
                allEvolutionTargets.add(pkmn.evolution);
            }
        }
        for (const name in pokemonBaseStatsData) {
            const pkmn = name;
            // Check if it's not an evolution target and Gen 1
            if (!allEvolutionTargets.has(name) && pokemonBaseStatsData[name].pokedexId <= 151) {
                hatchablePokemon.push(pkmn);
            }
        }
    }
    else {
        let eggtype = eggData[type];
        const totalChance = eggtype.hatchablePokemon.reduce((sum, pkmn) => sum + pkmn.chance, 0);
        let randomRoll = Math.random() * totalChance;
        let selectedPokemonData;
        let availablePokemon = eggtype.hatchablePokemon;
        for (const pkmn of availablePokemon) {
            if (randomRoll < pkmn.chance) {
                selectedPokemonData = pkmn;
                break;
            }
        randomRoll -= pkmn.chance;
        }
        return new Pokemon(selectedPokemonData.name, 1);
    }
    const randomIndex = Math.floor(Math.random() * hatchablePokemon.length);

    chosenPokemonData = hatchablePokemon[randomIndex];
    if (hatchablePokemon.length === 0) {
        console.error("No hatchable Pokémon found!");
        return new Pokemon('Magikarp', 1); // Fallback
    }
    return new Pokemon(chosenPokemonData, 1); 
}

export function handleEggClick(override = false) {
    if (gameState.EggIsClaimable || override) {
        if (!gameState.playerHasUnincubatedEgg && !gameState.incubator.eggDetails && !gameState.incubator.isHatchingReady) {
            gameState.playerHasUnincubatedEgg = true;
            gameState.EggIsClaimable = false;
            gameState.eggNextAvailableTimestamp = Date.now() + EGG_GENERATION_TIME;
            addBattleLog(`You claimed an Egg! You can start incubating it now.`);
            updateEggUI();
            updateIncubatorUI(); // Incubator might become available
        } // No specific message if incubator is busy, as the click handler on incubator will manage that
    } 
}

export function handleIncubatorClick(type = 'mystery', override = false) {
    if (gameState.incubator.isHatchingReady || override) {
        if (override) createEgg(type, override); // Hatch
        const hatchedPokemon = getRandomHatchablePokemon(gameState.incubator.eggDetails.type);
        const emptyPartySlot = gameState.party.findIndex(slot => slot === null);
        console.log(`Your egg hatched into a ${hatchedPokemon.isShiny ? 'Shiny ' : ''}${hatchedPokemon.name}!`);
        if (emptyPartySlot !== -1) {
            gameState.party[emptyPartySlot] = hatchedPokemon;
            if (getActivePokemon() === null) { // If no active Pokemon, make this the active one
                gameState.activePokemonIndex = emptyPartySlot;
            }
        } else {
            gameState.allPokemon.push(hatchedPokemon);
        }

        updateDisplay();
        addBattleLog(`Your egg hatched into a ${hatchedPokemon.isShiny ? 'Shiny ' : ''}${hatchedPokemon.name}!`);
        gameState.incubator = { eggDetails: null, incubationEndTime: null, isHatchingReady: false };
        updateIncubatorUI();
    } else if (gameState.playerHasUnincubatedEgg && !gameState.incubator.eggDetails) {
        const totalEggChance = Object.values(eggData).reduce((sum, egg) => sum + egg.chance, 0);
        let eggRandomRoll = Math.random() * totalEggChance;
        let selectedEggType = 'mystery'; // Default to mystery if something goes wrong
        for (const eggType in eggData) {
            if (eggRandomRoll < eggData[eggType].chance) {
                selectedEggType = eggType;
                break;
            }
            eggRandomRoll -= eggData[eggType].chance;
        }
        createEgg(selectedEggType);
    }
}

function createEgg(type = 'mystery', hatchNow = false) {
        gameState.incubator.eggDetails = { type: type }; 
        gameState.incubator.incubationEndTime = Date.now() + (0 ? hatchNow : eggData[type].incubationTime * INCUBATION_TIME);
        gameState.incubator.isHatchingReady = hatchNow;
        gameState.playerHasUnincubatedEgg = false; // Egg moved to incubator
        addBattleLog("Egg has started incubating.");
        updateIncubatorUI();
}


export function updateEggUI() {
    if (eggInterval) clearInterval(eggInterval);

    const progressBar = getElementByIdSafe('egg-progress-bar');
    const timerText = getElementByIdSafe('egg-timer-text');
    const wrapper = getElementByIdSafe('egg-progress-wrapper');

    if (!progressBar || !timerText || !wrapper) return; // Adjusted condition


    if (gameState.EggIsClaimable) {
        progressBar.style.width = '100%';
        wrapper.classList.add('claimable');

        if (gameState.incubator.eggDetails || gameState.incubator.isHatchingReady) {
            timerText.textContent = 'Incubator Busy!';
            wrapper.title = "Egg ready, but incubator is in use. Hatch current egg first.";
            wrapper.classList.add('disabled'); // Also make it non-clickable if incubator is busy

        } else {
            wrapper.classList.remove('disabled');
            timerText.textContent = 'Ready to Claim!';
            wrapper.title = "Click to claim your Egg!";
        }
    } else {
        wrapper.classList.remove('claimable')
        wrapper.classList.add('disabled'); // Make non-clickable while generating
        if (!gameState.eggNextAvailableTimestamp) {
            // Start generation if it hasn't started (e.g., first load or after a claim where it wasn't set)
            gameState.eggNextAvailableTimestamp = Date.now() + EGG_GENERATION_TIME;
        }

        const timeLeft = gameState.eggNextAvailableTimestamp - Date.now();

        if (timeLeft <= 0) {
            gameState.EggIsClaimable = true;
            gameState.eggNextAvailableTimestamp = null; // Clear timestamp once ready
            updateEggUI(); // Re-run to show claimable state
            return;
        }

        const progress = Math.max(0, (EGG_GENERATION_TIME - timeLeft) / EGG_GENERATION_TIME * 100);
        progressBar.style.width = `${progress}%`;
        timerText.textContent = formatDuration(timeLeft);
        // statusText.textContent = 'Finding an Egg...'; // Removed as element doesn't exist
        wrapper.title = `Finding an Egg... Time remaining: ${formatDuration(timeLeft)}`;

        eggInterval = setInterval(updateEggUI, 1000);
    }
}


export function updateIncubatorUI() {
    if (incubatorInterval) clearInterval(incubatorInterval);

    const progressBar = getElement('incubator-progress-bar');
    const timerText = getElement('incubator-timer-text');
    const statusText = getElement('incubator-status');
    const wrapper = getElementByIdSafe('incubator-progress-wrapper');
    const eggSprite = getElementByIdSafe('incubator-egg-sprite');
    let eggSpriteimg;
    if (gameState.incubator.eggDetails) {
        eggSpriteimg = eggData[gameState.incubator.eggDetails.type].image;
    }
    else {
        eggSpriteimg = '/sprites/pokemon/eggs/mystery-egg.png';
    }
    

    if (!progressBar || !timerText || !statusText || !wrapper || !eggSprite) return; // statusText is valid for incubator

    wrapper.classList.remove('incubating', 'hatchable', 'disabled');
    eggSprite.classList.remove('wiggle');
    eggSprite.style.display = 'none'; // Hide by default

    if (gameState.incubator.isHatchingReady) {
        progressBar.style.width = '100%';
        timerText.textContent = 'Ready to Hatch!';
        statusText.textContent = 'Egg Ready to Hatch!';
        wrapper.classList.add('hatchable'); // You'll need to add CSS for .hatchable
        wrapper.title = "Click to hatch your egg!";
        eggSprite.src = eggSpriteimg;
        eggSprite.style.display = 'block';
        eggSprite.classList.add('wiggle');
    } else if (gameState.incubator.eggDetails) { // Currently incubating
        wrapper.classList.add('incubating');
        wrapper.classList.add('disabled'); // Make non-clickable while incubating

        const timeLeft = gameState.incubator.incubationEndTime - Date.now();
        eggSprite.src = eggSpriteimg;
        eggSprite.style.display = 'block';

        if (timeLeft <= 0) {
            gameState.incubator.isHatchingReady = true;
            updateIncubatorUI(); // Re-run to show hatchable state
            return;
        }
        let t = gameState.incubator.eggDetails.type;

        const progress = Math.max(0, ((eggData[t].incubationTime * INCUBATION_TIME) - timeLeft) / (eggData[t].incubationTime * INCUBATION_TIME )* 100);
        progressBar.style.width = `${progress}%`;
        timerText.textContent = formatDuration(timeLeft);
        statusText.textContent = 'Incubating...';
        wrapper.title = `Incubating egg. Time remaining: ${formatDuration(timeLeft)}`;

        incubatorInterval = setInterval(updateIncubatorUI, 1000);
    } else { // Incubator empty, not hatching
        progressBar.style.width = '0%';
        timerText.textContent = formatDuration(0); // Show full duration
        if (gameState.playerHasUnincubatedEgg) {
            statusText.textContent = 'Egg ready to incubate.';
            wrapper.title = "You have an egg! Click to start incubation.";
        } else {
            statusText.textContent = 'No egg to incubate.';
            wrapper.classList.add('disabled');
            wrapper.title = "Claim an Egg first to use the incubator.";
        }
    }
}
