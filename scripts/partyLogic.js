// scripts/partyLogic.js
import { gameState, pokemonBaseStatsData } from './state.js'; // pokemonBaseStatsData might be needed for evolution checks if not self-contained in Pokemon class
import { addBattleLog, getActivePokemon } from './utils.js';
import { updateDisplay, populateRouteSelector } from './ui.js';
// Pokemon class is needed for evolution.
import { Pokemon } from './pokemon.js';


export function addToParty(pokemonIndexInStorage, partySlot) {
    const pokemonToMove = gameState.allPokemon[pokemonIndexInStorage];
    if (!pokemonToMove) {
        addBattleLog("Error: Pokémon not found in storage.");
        return;
    }

    // If the target party slot is occupied, move the existing Pokémon to storage
    if (gameState.party[partySlot] !== null) {
        // Ensure the Pokémon being moved from party to storage isn't already there (edge case)
        if (!gameState.allPokemon.includes(gameState.party[partySlot])) {
             gameState.allPokemon.unshift(gameState.party[partySlot]); // Add to beginning of storage for visibility
        } else {
            // If it is somehow already there, this indicates a potential duplication issue elsewhere or complex swap.
            // For simplicity, we'll just overwrite the slot, assuming the one in storage is the "canonical" one if IDs matched.
            // Or, better, remove the one from storage that's about to be "replaced" by the party one.
            // This scenario should be rare if IDs are unique and managed well.
            console.warn("Attempting to move a Pokémon from party to storage that might already be in storage. Review logic if issues arise.");
        }
    }

    gameState.party[partySlot] = pokemonToMove;
    gameState.allPokemon.splice(pokemonIndexInStorage, 1); // Remove from storage

    // If no active Pokémon, or the active one was in the slot just filled by a PC mon, set new active.
    if (getActivePokemon() === null || gameState.activePokemonIndex === partySlot) {
        const firstHealthyInParty = gameState.party.findIndex(p => p && p.currentHp > 0);
        gameState.activePokemonIndex = firstHealthyInParty !== -1 ? firstHealthyInParty : 0;
    }

    populateRouteSelector();
    updateDisplay();
    addBattleLog(`${pokemonToMove.name} moved to party slot ${partySlot + 1}.`);
}

export function removeFromParty(partySlot) {
    if (gameState.party[partySlot]) {
        const pokemonToStore = gameState.party[partySlot];
        // Add to the beginning of the allPokemon array to make it more visible in the PC
        gameState.allPokemon.unshift(pokemonToStore);
        gameState.party[partySlot] = null;

        addBattleLog(`${pokemonToStore.name} moved to PC.`);

        if (gameState.activePokemonIndex === partySlot) {
            const nextHealthy = gameState.party.findIndex(p => p && p.currentHp > 0);
            // If no healthy Pokémon left in party, active index might point to a null slot or first slot.
            // getActivePokemon() will handle returning null if the slot is empty.
            gameState.activePokemonIndex = nextHealthy !== -1 ? nextHealthy : 0;
        }
        populateRouteSelector();
        updateDisplay();
    }
}

export function setActivePokemon(partyIndex) {
    if (gameState.party[partyIndex] && gameState.party[partyIndex].currentHp > 0) {
        gameState.activePokemonIndex = partyIndex;
        updateDisplay();
        addBattleLog(`${gameState.party[partyIndex].name} is now active!`);
    } else if (gameState.party[partyIndex]) {
        addBattleLog(`${gameState.party[partyIndex].name} has 0 HP and cannot be selected as active.`);
    } else {
        addBattleLog(`No Pokémon in slot ${partyIndex + 1}.`);
    }
}

export async function attemptEvolution(index, locationType) {
    let pokemonToEvolve = locationType === 'party' ? gameState.party[index] : gameState.allPokemon[index];
    if (!pokemonToEvolve) {
        addBattleLog("Error: Could not find Pokémon to evolve.");
        return;
    }

    const canEvolveByLevel = pokemonToEvolve.evolutionTargetName &&
                             pokemonToEvolve.evolveLevel &&
                             pokemonToEvolve.level >= pokemonToEvolve.evolveLevel;

    if (canEvolveByLevel) {
        // The evolve method itself will handle stat updates, name changes, and logging.
        if (await pokemonToEvolve.evolve()) { // Pokemon.evolve is async
            // If evolution was successful
            if (locationType === 'party') {
                populateRouteSelector(); // Evolution might change average level if it was a party member
            }
            updateDisplay();
        } else {
            // Pokemon.evolve should ideally log why it couldn't evolve if it was a valid attempt.
            // This path might be taken if, for example, data for the evolution target couldn't be loaded.
            // addBattleLog(`${pokemonToEvolve.name} could not evolve at this time.`); // Already logged by Pokemon.evolve or getStatsData
        }
    } else {
         addBattleLog(`${pokemonToEvolve.name} is not ready to evolve by level up.`);
    }
}


export function confirmReleasePokemon(storageIndex) {
    const pokemonToRelease = gameState.allPokemon[storageIndex];
    if (!pokemonToRelease) return;

    const totalPokemonCount = gameState.party.filter(p => p !== null).length + gameState.allPokemon.length;
    if (totalPokemonCount <= 1) {
        alert("You cannot release your last Pokémon!");
        addBattleLog("Cannot release the last Pokémon.");
        return;
    }

    if (window.confirm(`Release ${pokemonToRelease.nickname || pokemonToRelease.name} (Lvl. ${pokemonToRelease.level})? This cannot be undone.`)) {
        releasePokemon(storageIndex);
    }
}

function releasePokemon(storageIndex) { // Made internal, called by confirmReleasePokemon
    const releasedPokemonArray = gameState.allPokemon.splice(storageIndex, 1);
    if (releasedPokemonArray && releasedPokemonArray.length > 0) {
        const releasedPokemon = releasedPokemonArray[0];
        addBattleLog(`${releasedPokemon.nickname || releasedPokemon.name} has been released.`);
        updateDisplay();
        // saveGame(); // Game is saved periodically or manually by user.
    }
}

export function changePokemonNickname(index, locationType, newNicknameStr) {
    let pokemonToNickname;
    if (locationType === 'party') {
        pokemonToNickname = gameState.party[index];
    } else if (locationType === 'storage') {
        pokemonToNickname = gameState.allPokemon[index];
    } else if (locationType === 'player' && getActivePokemon() && index === -1) {
        // Special case for active player Pokemon from modal, index is -1
        pokemonToNickname = getActivePokemon();
    }


    if (!pokemonToNickname) {
        addBattleLog("Error: Could not find Pokémon to nickname.");
        console.error(`Pokemon not found at index ${index} in ${locationType}`);
        return;
    }

    const oldNickname = pokemonToNickname.nickname || pokemonToNickname.name; // Fallback to species name if no nickname
    const speciesName = pokemonToNickname.name;

    // Pokemon.setNickname handles validation, truncation, and resetting to species name if empty.
    const actualNewNickname = pokemonToNickname.setNickname(newNicknameStr);

    // Log the outcome based on what setNickname returned and what was intended.
    if (oldNickname === actualNewNickname) {
        if (newNicknameStr && newNicknameStr.trim().length > 12 && actualNewNickname.length === 12 && newNicknameStr.trim().substring(0,12) === actualNewNickname) {
            // This case is a bit redundant if Pokemon.setNickname already truncated.
            // It's more about confirming the user's *intention* vs the *result*.
            addBattleLog(`Nickname for ${speciesName} was too long. It remains "${actualNewNickname}".`);
        } else if ((!newNicknameStr || newNicknameStr.trim() === "") && actualNewNickname === speciesName) {
             // User tried to clear, and it correctly reset to species name (which was also the old nickname)
             addBattleLog(`${speciesName}'s nickname is already its species name.`);
        } else {
            // No change was effectively made or requested that differed from current state.
            addBattleLog(`${oldNickname}'s nickname remains unchanged.`);
        }
    } else if (actualNewNickname === speciesName) {
        addBattleLog(`${oldNickname}'s nickname was reset to ${speciesName}.`);
    } else if (newNicknameStr && newNicknameStr.trim().length > 12) {
        addBattleLog(`${oldNickname}'s nickname was too long and has been set to "${actualNewNickname}".`);
    } else {
        addBattleLog(`${oldNickname}'s nickname changed to "${actualNewNickname}".`);
    }

    updateDisplay();
    // saveGame(); // Game is saved periodically
}
