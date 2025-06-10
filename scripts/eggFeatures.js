import { gameState } from './state.js'; 
import { pokemonBaseStatsData } from './state.js'; 
import { Pokemon } from './pokemon.js';

import { addBattleLog, getActivePokemon} from './utils.js'; 
import { updateDisplay} from './ui.js';

const MYSTERY_EGG_GENERATION_TIME = 4 * 60 * 60 * 1000; // 4 hours in ms
const INCUBATION_TIME = 1 * 60 * 60 * 1000; // 1 hour in ms

let mysteryEggInterval;
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
    if (gameState.mysteryEggNextAvailableTimestamp === undefined) gameState.mysteryEggNextAvailableTimestamp = null;
    if (gameState.mysteryEggIsClaimable === undefined) gameState.mysteryEggIsClaimable = false;
    if (gameState.playerHasUnincubatedEgg === undefined) gameState.playerHasUnincubatedEgg = false;

    updateMysteryEggUI();
    updateIncubatorUI();
}

// Function to safely get an element
function getElementByIdSafe(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`Element with ID '${id}' not found.`);
    return el;
}

function getRandomHatchablePokemon() {
    // For a "Mystery Egg", let's pick a random base-stage Pokémon from Gen 1 for simplicity.
    // A more robust system might have specific egg groups or rarities.
    const allEvolutionTargets = new Set();
    for (const name in pokemonBaseStatsData) {
        const pkmn = pokemonBaseStatsData[name];
        if (pkmn.evolutionTargetName) {
            allEvolutionTargets.add(pkmn.evolutionTargetName);
        }
    }

    const hatchablePokemon = [];
    for (const name in pokemonBaseStatsData) {
        const pkmn = name;
        // Check if it's not an evolution target
        if (!allEvolutionTargets.has(name)) {
            hatchablePokemon.push(pkmn);
        }
    }
    if (hatchablePokemon.length === 0) {
        console.error("No hatchable Pokémon found!");
        return new Pokemon('Magikarp', 1); // Fallback
    }
    const randomIndex = Math.floor(Math.random() * hatchablePokemon.length);
    const chosenPokemonData = hatchablePokemon[randomIndex];
    return new Pokemon(chosenPokemonData, 1); 
}

export function handleMysteryEggClick() {
    if (gameState.mysteryEggIsClaimable) {
        if (!gameState.playerHasUnincubatedEgg && !gameState.incubator.eggDetails && !gameState.incubator.isHatchingReady) {
            gameState.playerHasUnincubatedEgg = true;
            gameState.mysteryEggIsClaimable = false;
            // Start generating the next egg immediately
            gameState.mysteryEggNextAvailableTimestamp = Date.now() + MYSTERY_EGG_GENERATION_TIME;
            
            addBattleLog("You claimed a Mystery Egg!");
            
            updateMysteryEggUI();
            updateIncubatorUI(); // Incubator might become available
        } // No specific message if incubator is busy, as the click handler on incubator will manage that
    } else {
        // This case should ideally be prevented by the 'disabled' class making it non-clickable
        addBattleLog("The Mystery Egg is still generating.");
    }
}

export function handleIncubatorClick() {
    if (gameState.incubator.isHatchingReady) {
        const hatchedPokemon = getRandomHatchablePokemon();
        

        const emptyPartySlot = gameState.party.findIndex(slot => slot === null);
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
        gameState.incubator.eggDetails = { type: 'mystery' }; // Assuming it's the mystery egg
        gameState.incubator.incubationEndTime = Date.now() + INCUBATION_TIME;
        gameState.incubator.isHatchingReady = false;
        gameState.playerHasUnincubatedEgg = false; // Egg moved to incubator

        addBattleLog("Incubation started for the Mystery Egg.");
        updateIncubatorUI();
    } else if (gameState.incubator.eggDetails && !gameState.incubator.isHatchingReady) {
        addBattleLog("Egg is already incubating.");
    } else {
        addBattleLog("You don't have an egg to incubate.");
    }
}

export function updateMysteryEggUI() {
    if (mysteryEggInterval) clearInterval(mysteryEggInterval);

    const progressBar = getElementByIdSafe('mystery-egg-progress-bar');
    const timerText = getElementByIdSafe('mystery-egg-timer-text');
    // const statusText = getElementByIdSafe('mystery-egg-status'); // This element does not exist in the HTML for mystery egg
    const wrapper = getElementByIdSafe('mystery-egg-progress-wrapper');

    if (!progressBar || !timerText || !wrapper) return; // Adjusted condition

    wrapper.classList.remove('claimable', 'disabled');

    if (gameState.mysteryEggIsClaimable) {
        progressBar.style.width = '100%';
        wrapper.classList.add('claimable');

        if (gameState.incubator.eggDetails || gameState.incubator.isHatchingReady) {
            timerText.textContent = 'Incubator Busy!';
            wrapper.title = "Mystery Egg ready, but incubator is in use. Hatch current egg first.";
            wrapper.classList.add('disabled'); // Also make it non-clickable if incubator is busy
        } else {
            timerText.textContent = 'Ready to Claim!';
            wrapper.title = "Click to claim your Mystery Egg!";
        }
    } else {
        wrapper.classList.add('disabled'); // Make non-clickable while generating
        if (!gameState.mysteryEggNextAvailableTimestamp) {
            // Start generation if it hasn't started (e.g., first load or after a claim where it wasn't set)
            gameState.mysteryEggNextAvailableTimestamp = Date.now() + MYSTERY_EGG_GENERATION_TIME;
        }

        const timeLeft = gameState.mysteryEggNextAvailableTimestamp - Date.now();

        if (timeLeft <= 0) {
            gameState.mysteryEggIsClaimable = true;
            gameState.mysteryEggNextAvailableTimestamp = null; // Clear timestamp once ready
            updateMysteryEggUI(); // Re-run to show claimable state
            return;
        }

        const progress = Math.max(0, (MYSTERY_EGG_GENERATION_TIME - timeLeft) / MYSTERY_EGG_GENERATION_TIME * 100);
        progressBar.style.width = `${progress}%`;
        timerText.textContent = formatDuration(timeLeft);
        // statusText.textContent = 'Finding an Egg...'; // Removed as element doesn't exist
        wrapper.title = `Finding an Egg... Time remaining: ${formatDuration(timeLeft)}`;

        mysteryEggInterval = setInterval(updateMysteryEggUI, 1000);
    }
}


export function updateIncubatorUI() {
    if (incubatorInterval) clearInterval(incubatorInterval);

    const progressBar = getElement('incubator-progress-bar');
    const timerText = getElement('incubator-timer-text');
    const statusText = getElement('incubator-status');
    const wrapper = getElementByIdSafe('incubator-progress-wrapper');
    const eggSprite = getElementByIdSafe('incubator-egg-sprite');
    const eggSpriteimg = 'sprites/pokemon/mystery-egg.png';
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


        const progress = Math.max(0, (INCUBATION_TIME - timeLeft) / INCUBATION_TIME * 100);
        progressBar.style.width = `${progress}%`;
        timerText.textContent = formatDuration(timeLeft);
        statusText.textContent = 'Incubating...';
        wrapper.title = `Incubating egg. Time remaining: ${formatDuration(timeLeft)}`;

        incubatorInterval = setInterval(updateIncubatorUI, 1000);
    } else { // Incubator empty, not hatching
        progressBar.style.width = '0%';
        timerText.textContent = formatDuration(INCUBATION_TIME); // Show full duration
        if (gameState.playerHasUnincubatedEgg) {
            statusText.textContent = 'Egg ready to incubate.';
            wrapper.title = "You have an egg! Click to start incubation.";
        } else {
            statusText.textContent = 'No egg to incubate.';
            wrapper.classList.add('disabled');
            wrapper.title = "Claim a Mystery Egg first to use the incubator.";
        }
    }
}
