// scripts/ui/storageDisplay.js
import { gameState } from '../state.js'; // Adjusted path
import {
    getPokemonNameHTML,
    getPokemonSpritePath,
    getPokemonFullLevelText,
    getTypeIconsHTML,
    getPokemonDetailedStatsHTML,
    getPokemonHpBarHTML, // Ensure this takes (pokemon, baseId, index)
    getPokemonExpBarHTML
} from './pokemonDisplay.js'; // Adjusted path

// Functions from gameLogic or ui that are invoked by storage UI elements
// import { addToPartyDialog, confirmReleasePokemon, attemptEvolution } from '../gameLogic.js'; // Or from main ui.js
// import { handlePokemonSpriteClick } from './pokemonDisplayOrMainUI.js'


function generateStoragePokemonCardHTML(pokemon, index) {
    if (!pokemon) return ''; // Should not happen if iterating over gameState.allPokemon

    const shinyClass = pokemon.isShiny ? 'shiny-pokemon' : '';
    const spritePath = getPokemonSpritePath(pokemon, 'front');

    let evolveButtonHtml = '';
    if (pokemon.evolutionTargetName && pokemon.evolveLevel && pokemon.level >= pokemon.evolveLevel) {
        evolveButtonHtml = `<button class="btn small" data-action="evolve" data-index="${index}" data-location="storage" style="background: #ffc107; color: #333;">Evolve</button>`;
    }

    const controlsHtml = `
        <div class="controls" style="margin-top: 8px;">
            <button class="btn small secondary" data-action="addToPartyDialog" data-index="${index}" data-location="storage">
                Add to Party
            </button>
            <button class="btn small" data-action="confirmRelease" data-index="${index}" data-location="storage" style="background: #dc3545;">
                Release
            </button>
            ${evolveButtonHtml}
        </div>`;

    const spriteOnclickData = `data-action="spriteClick" data-index="${index}" data-location="storage"`;

    return `
        <div class="pokemon-card" data-pokemon-id="${pokemon.id}">
            <img class="pokemon-sprite zoomable-sprite ${shinyClass}" src="${spritePath}" alt="${pokemon.name}" style="image-rendering: pixelated; cursor: pointer;" ${spriteOnclickData}>
            <div class="pokemon-name">${getPokemonNameHTML(pokemon, 'shiny-indicator', true, false)}</div>
            <div class="pokemon-level-type-container">
                <span class="pokemon-level-text">${getPokemonFullLevelText(pokemon)}</span>
                ${getTypeIconsHTML(pokemon)}
            </div>
            ${getPokemonDetailedStatsHTML(pokemon)}
            ${getPokemonHpBarHTML(pokemon, 'storage', index)}
            ${getPokemonExpBarHTML(pokemon)}
            ${controlsHtml}
        </div>
    `;
}

export function updateStorageDisplay() {
    const storageListContainer = document.getElementById('team-list');
    if (!storageListContainer) {
        console.error("Storage list container 'team-list' not found.");
        return;
    }

    if (gameState.allPokemon.length === 0) {
        storageListContainer.innerHTML = `<div style="text-align: center; color: #ccc; margin-top: 50px;">No Pokemon in storage!</div>`;
        return;
    }

    storageListContainer.innerHTML = gameState.allPokemon
        .map((pokemon, index) => generateStoragePokemonCardHTML(pokemon, index))
        .join('');
}
