// scripts/ui/modalDisplay.js
import { gameState, pokemonBaseStatsData } from '../state.js'; // Adjusted path
import { addBattleLog } from '../utils.js'; // Adjusted path
import { POKEMON_SPRITE_BASE_URL, STARTER_POKEMON_NAMES } from '../config.js'; // Adjusted path
import { Pokemon } from '../pokemon.js'; // Adjusted path for Pokemon class
import { getPokemonNameHTML, getPokemonSpritePath } from './pokemonDisplay.js'; // Adjusted path
// import { changePokemonNickname } from '../gameLogic.js'; // Will be imported in main ui.js or passed if needed

// This module will handle showing/hiding modals and populating their content.
// Event listeners for buttons INSIDE modals might be attached here or in main ui.js event delegation.

// --- Starter Selection Modal ---
export async function showStarterSelectionModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('starter-modal');
        const optionsContainer = modal.querySelector('.starter-options');
        if (!modal || !optionsContainer) {
            console.error("Starter selection modal elements not found.");
            resolve(); // Resolve to not block game load, but log error
            return;
        }
        optionsContainer.innerHTML = ''; // Clear previous options

        STARTER_POKEMON_NAMES.forEach(name => {
            const pkmnData = pokemonBaseStatsData[name];
            if (!pkmnData) {
                console.warn(`Starter Pokemon ${name} not found in statmap.`);
                return;
            }
            const optionDiv = document.createElement('div');
            optionDiv.className = 'starter-option';
            // Assuming getPokemonSpritePath can handle pokedexId directly if useAPI is true
            const spriteUrl = getPokemonSpritePath({ pokedexId: pkmnData.pokedexId, isShiny: false, name: name }, 'front');

            optionDiv.innerHTML = `
                <img src="${spriteUrl}" alt="${name}">
                <div class="pokemon-name">${name}</div>
            `;
            optionDiv.onclick = async () => {
                const starterPokemon = await Pokemon.create(name, 5);
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

// --- Settings Modal ---
export function showSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'flex';
}

export function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

// --- Export Save Modal ---
export function showExportModal(dataString) {
    const modal = document.getElementById('export-save-modal');
    const textarea = document.getElementById('export-save-textarea');
    const feedbackMessage = document.getElementById('copy-feedback-message');

    if (modal && textarea) {
        textarea.value = dataString;
        modal.style.display = 'flex';
        if (feedbackMessage) feedbackMessage.style.display = 'none';
    } else {
        console.error("Export modal elements not found.");
        alert("Could not display export window.");
    }
}

export function closeExportModal() {
    const modal = document.getElementById('export-save-modal');
    if (modal) modal.style.display = 'none';
}

// --- Import Save Modal ---
export function showImportModal() {
    const modal = document.getElementById('import-save-modal');
    const textarea = document.getElementById('import-save-textarea');
    if (modal && textarea) {
        textarea.value = '';
        modal.style.display = 'flex';
    } else {
        console.error("Import modal elements not found.");
        alert("Could not display import window.");
    }
}

export function closeImportModal() {
    const modal = document.getElementById('import-save-modal');
    if (modal) modal.style.display = 'none';
}

// --- Pokémon Image & Nickname Modal ---
export function showPokemonImageModal(pokemon, index, locationType, changeNicknameCallback) {
    const modal = document.getElementById('pokemon-image-modal');
    const titleEl = document.getElementById('pokemon-image-modal-title');
    const spriteEl = document.getElementById('pokemon-image-modal-sprite');
    const nicknameContainer = document.getElementById('modal-nickname-container');
    const nicknameInput = document.getElementById('modal-nickname-input');
    const setNicknameBtn = document.getElementById('modal-set-nickname-btn');

    if (modal && titleEl && spriteEl && nicknameContainer && nicknameInput && setNicknameBtn && pokemon) {
        titleEl.innerHTML = getPokemonNameHTML(pokemon); // Uses defaults from pokemonDisplay
        spriteEl.src = getPokemonSpritePath(pokemon, 'front');
        spriteEl.alt = pokemon.nickname || pokemon.name;

        // Nickname input: only for player's Pokémon (party or storage)
        const isPlayerPokemon = (locationType === 'party' || locationType === 'storage') && index !== -1;
        // Or if it's the active player pokemon shown via special 'player' locationType
        const isActivePlayerPokemon = locationType === 'player' && pokemon === gameState.party[gameState.activePokemonIndex];

        if (isPlayerPokemon || isActivePlayerPokemon) {
            nicknameContainer.style.display = 'flex';
            nicknameInput.value = pokemon.nickname || pokemon.name;
            nicknameInput.maxLength = 12;

            // Determine the correct index for nickname change
            let actualIndex = index;
            let actualLocation = locationType;
            if (isActivePlayerPokemon && locationType === 'player') {
                actualIndex = gameState.activePokemonIndex;
                actualLocation = 'party'; // Active Pokémon is always in party
            }


            setNicknameBtn.onclick = () => {
                const newNickname = nicknameInput.value;
                if (typeof changeNicknameCallback === 'function') {
                    changeNicknameCallback(actualIndex, actualLocation, newNickname);
                }
                closePokemonImageModal();
            };
        } else {
            nicknameContainer.style.display = 'none';
            setNicknameBtn.onclick = null;
        }
        modal.style.display = 'flex';
    } else {
        console.error("Pokemon image modal elements not found or no Pokemon data.");
    }
}

export function closePokemonImageModal() {
    const modal = document.getElementById('pokemon-image-modal');
    if (modal) modal.style.display = 'none';
}

// --- Event Modal ---
export function showEventModalUI(eventData) { // Renamed to avoid conflict with gameLogic's showEventModal
    const modal = document.getElementById('event-modal');
    const titleEl = document.getElementById('event-modal-title');
    const imageEl = document.getElementById('event-modal-image');
    const messageEl = document.getElementById('event-modal-message');

    if (modal && titleEl && imageEl && messageEl) {
        titleEl.textContent = eventData.name || "An Event Occurred!";
        imageEl.src = eventData.image || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="; // Placeholder
        imageEl.alt = eventData.name || "Event Image";

        let displayMessage = eventData.message || eventData.description;
        if (eventData.type === "give_item" && eventData.resolvedQuantity !== undefined) {
            displayMessage = displayMessage.replace("{quantity}", eventData.resolvedQuantity.toString());
        }
        messageEl.textContent = displayMessage;
        modal.style.display = 'flex';
    } else {
        console.error("Event modal elements not found.");
    }
}

export function closeEventModal() {
    const modal = document.getElementById('event-modal');
    if (modal) modal.style.display = 'none';
}

// --- PC Drawer ---
export function togglePcDrawer() {
    const pcDrawer = document.getElementById('pc-drawer');
    if (pcDrawer) {
        pcDrawer.classList.toggle('open');
        // Optional: body class for overlay or scroll lock can be managed here or in main ui.js
    }
}
