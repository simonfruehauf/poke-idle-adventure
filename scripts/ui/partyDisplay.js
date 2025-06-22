// scripts/ui/partyDisplay.js
import { gameState } from '../state.js'; // Adjusted path
import { getActivePokemon } from '../utils.js'; // Adjusted path
import {
    getPokemonNameHTML,
    getPokemonSpritePath,
    getPokemonFullLevelText,
    getTypeIconsHTML,
    getPokemonDetailedStatsHTML,
    getPokemonHpBarHTML, // Ensure this takes (pokemon, baseId, index)
    getPokemonExpBarHTML
} from './pokemonDisplay.js'; // Adjusted path

// Functions from gameLogic that are invoked by party UI elements
// These will eventually be imported from their new specific logic modules via main.js or directly.
// For now, assuming they are available on window or will be passed/imported.
// import { setActivePokemon, removeFromParty, attemptEvolution } from '../gameLogic.js';
// For handlePokemonSpriteClick, addToPartyDialog, confirmReleasePokemon, these are UI-level interactions
// that might call partyLogic functions. The actual call will be in main ui.js or here.

function generatePartySlotHTML(pokemon, index) {
    if (!pokemon) {
        return '<div style="color: #ccc;">Empty Slot</div>';
    }

    const shinyClass = pokemon.isShiny ? 'shiny-pokemon' : '';
    const spritePath = getPokemonSpritePath(pokemon, 'front');
    const isActive = gameState.activePokemonIndex === index;

    let evolveButtonHtml = '';
    if (pokemon.evolutionTargetName && pokemon.evolveLevel && pokemon.level >= pokemon.evolveLevel) {
        // onclick will be handled by event delegation in main ui.js or by direct attachment if preferred
        evolveButtonHtml = `<button class="btn small" data-action="evolve" data-index="${index}" data-location="party" style="background: #ffc107; color: #333;">Evolve</button>`;
    }

    const controlsHtml = `
        <div class="controls" style="margin-top: 8px;">
            <button class="btn small ${isActive ? 'secondary' : ''}"
                    data-action="setActive" data-index="${index}" data-location="party"
                    ${pokemon.currentHp <= 0 ? 'disabled' : ''}>
                ${isActive ? 'Active' : 'Select'}
            </button>
            <button class="btn small" data-action="removeFromParty" data-index="${index}" data-location="party" style="background: #f44336;">
                Remove
            </button>
            ${evolveButtonHtml}
        </div>`;

    const spriteOnclickData = `data-action="spriteClick" data-index="${index}" data-location="party"`;

    return `
        <img class="pokemon-sprite zoomable-sprite ${shinyClass}" src="${spritePath}" alt="${pokemon.name}" style="cursor: pointer;" ${spriteOnclickData}>
        <div class="pokemon-name">${getPokemonNameHTML(pokemon, 'shiny-indicator', true, false)}</div>
        <div class="pokemon-level-type-container">
            <span class="pokemon-level-text">${getPokemonFullLevelText(pokemon)}</span>
            ${getTypeIconsHTML(pokemon)}
        </div>
        ${getPokemonDetailedStatsHTML(pokemon)}
        ${getPokemonHpBarHTML(pokemon, 'party', index)}
        ${getPokemonExpBarHTML(pokemon)}
        ${controlsHtml}
    `;
}

export function updatePartyDisplay() {
    const partySlotsContainer = document.getElementById('party-slots');
    if (!partySlotsContainer) return;

    // Clear existing slots (important if number of slots could change, or for clean redraw)
    // partySlotsContainer.innerHTML = ''; // Or update existing ones

    for (let i = 0; i < 6; i++) {
        const slotElementId = `party-${i}`;
        let slot = document.getElementById(slotElementId);

        // If slots are not pre-defined in HTML, create them.
        // For this project, they are pre-defined.
        if (!slot) {
            console.error(`Party slot element ${slotElementId} not found.`);
            continue;
        }

        const pokemon = gameState.party[i];
        const isActive = gameState.activePokemonIndex === i && pokemon !== null;

        slot.classList.remove('filled', 'active-pokemon-slot'); // Reset classes

        if (pokemon) {
            slot.classList.add('filled');
            if (isActive) {
                slot.classList.add('active-pokemon-slot');
            }
            slot.innerHTML = generatePartySlotHTML(pokemon, i);
        } else {
            slot.innerHTML = '<div style="color: #ccc;">Empty Slot</div>'; // Default for empty
        }
    }
}
