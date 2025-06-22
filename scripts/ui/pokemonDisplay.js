// scripts/ui/pokemonDisplay.js
import { gameState, pokeballData, itemData, routes, pokemonBaseStatsData } from '../state.js'; // Adjusted path
import { getActivePokemon } from '../utils.js'; // Adjusted path
import { TYPE_ICON_BASE_URL, TYPE_NAMES, POKEMON_SPRITE_BASE_URL, USE_API_FOR_SPRITES_AND_TYPES } from '../config.js'; // Adjusted path & imported new const

export function getTypeIconsHTML(pokemon) {
    if (!pokemon || !pokemon.types || pokemon.types.length === 0) return '';
    let iconsHTML = '';
    pokemon.types.forEach(type => {
        let url = "";
        if (type && TYPE_NAMES.includes(type)) {
            if (USE_API_FOR_SPRITES_AND_TYPES) {
                const typeIndex = TYPE_NAMES.findIndex(t => t === type) + 1;
                if (typeIndex !== -1 && typeIndex < 18) { // Gen 3 had 17 types + Unknown/Shadow
                    url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-iii/emerald/${typeIndex}.png`;
                } else if (typeIndex === 18) { // Fairy (not in Gen 3 official sprites)
                    url = `${TYPE_ICON_BASE_URL}${type.toLowerCase()}.png`; // Use local fallback
                } else { // Unknown/Shadow or error
                    url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-iii/emerald/10001.png`; // Unknown type
                }
            } else {
                url = `${TYPE_ICON_BASE_URL}${type.toLowerCase()}.png`;
            }
            iconsHTML += `<img src="${url}" alt="${type}" title="${type}" class="type-icon">`;
        } else {
            iconsHTML += `<img src="${TYPE_ICON_BASE_URL}null.png" alt="null" title="Null" class="type-icon">`;
        }
    });
    return iconsHTML;
}

export function getPokemonNameHTML(pokemon, shinyIndicatorClass = 'shiny-indicator', showBallIcon = false, checkCaughtStatus = false) {
    if (!pokemon) return '';
    let ballIconHTML = '';

    if (showBallIcon && pokemon.caughtWithBall) {
        const ballId = pokemon.caughtWithBall;
        const ballInfo = pokeballData[ballId] || pokeballData.pokeball;
        if (ballInfo && ballInfo.image) {
            ballIconHTML = `<img src="${ballInfo.image}" alt="${ballInfo.name}" title="Caught with ${ballInfo.name}" class="inline-ball-icon"> `;
        }
    }

    const shinySpan = pokemon.isShiny ? ` <span class="${shinyIndicatorClass}">✨</span>` : '';
    let caughtIndicatorHTML = '';

    if (checkCaughtStatus && pokemon.pokedexId) {
        const isCaught = gameState.party.some(p => p && p.pokedexId === pokemon.pokedexId) ||
                         gameState.allPokemon.some(p => p && p.pokedexId === pokemon.pokedexId);
        const pokeballImageSrc = pokeballData.pokeball?.image;
        const titleText = isCaught ? 'Caught' : 'Not Caught';

        if (pokeballImageSrc) {
            const caughtClass = isCaught ? ' is-caught' : '';
            caughtIndicatorHTML = `<img src="${pokeballImageSrc}" alt="Caught Status" title="${titleText}" class="caught-indicator-icon${caughtClass}"> `;
        }
    }

    const displayName = pokemon.nickname || pokemon.name;
    return `${caughtIndicatorHTML}${ballIconHTML}${displayName}${shinySpan}`;
}

export function getPokemonSpritePath(pokemon, spriteType = 'front') {
    // This function assumes POKEMON_SPRITE_BASE_URL is for local sprites.
    // The 'USE_API_FOR_SPRITES_AND_TYPES' constant determines if PokeAPI URLs are used instead.
    if (USE_API_FOR_SPRITES_AND_TYPES) {
        if (!pokemon || !pokemon.pokedexId) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png`; // MissingNo. or placeholder
        const back = spriteType === 'back' ? 'back/' : '';
        const shiny = pokemon.isShiny ? 'shiny/' : '';
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${back}${shiny}${pokemon.pokedexId}.png`;
    } else {
        if (!pokemon || !pokemon.pokedexId) return `${POKEMON_SPRITE_BASE_URL}${spriteType}/000.png`; // Local placeholder
        const shinyPrefix = pokemon.isShiny ? 'shiny/' : '';
        // Assuming local paths are like './sprites/pokemon/front/1.png' or './sprites/pokemon/front/shiny/1.png'
        return `${POKEMON_SPRITE_BASE_URL}${spriteType}/${shinyPrefix}${pokemon.pokedexId}.png`;
    }
}

export function getPokemonLevelText(pokemon) {
    if (!pokemon || typeof pokemon.level === 'undefined') return '';
    return `Lv.${pokemon.level}`;
}

export function getPokemonFullLevelText(pokemon) { // Used for party/storage display
    if (!pokemon || typeof pokemon.level === 'undefined') return '';
    return `Lv.${pokemon.level}`;
}


export function getPokemonHpText(pokemon) {
    if (!pokemon) return 'HP: 0/0';
    return `HP: ${pokemon.currentHp}/${pokemon.maxHp}`;
}

export function getPokemonStatsString(pokemon) {
    if (!pokemon) return 'ATK: 0 | DEF: 0 | SPD: 0';
    return `ATK: ${pokemon.attack} | DEF: ${pokemon.defense} | SPD: ${pokemon.speed}`;
}

export function getPokemonDetailedStatsHTML(pokemon) {
    if (!pokemon) return '';
    return `
        <div class="pokemon-detailed-stats">HP: ${pokemon.currentHp}/${pokemon.maxHp} | SPD: ${pokemon.speed}</div>
        <div class="pokemon-detailed-stats">ATK: ${pokemon.attack} | DEF: ${pokemon.defense} </div>
    `;
}

export function getPokemonExpBarHTML(pokemon) {
    if (!pokemon || typeof pokemon.exp !== 'number' || typeof pokemon.expToNext !== 'number' || pokemon.expToNext === 0) {
        const titleText = `0 / 0 EXP`;
        return `<div class="pokemon-exp" title="${titleText}" style="height: 8px; margin: 5px 0;"><div class="exp-fill" style="width: 0%"></div></div>`;
    }
    const expPercentage = Math.min(100, (pokemon.exp / pokemon.expToNext) * 100); // Cap at 100% for display
    const titleText = `${pokemon.exp} / ${pokemon.expToNext} EXP`;
    return `<div class="pokemon-exp" title="${titleText}" style="height: 8px; margin: 5px 0;"><div class="exp-fill" style="width: ${expPercentage}%"></div></div>`;
}

export function getPokemonHpBarHTML(pokemon, baseId, index) { // Added baseId for uniqueness
    const barId = `${baseId}-hp-bar-${index}`;
    if (!pokemon || pokemon.maxHp <= 0) {
        const titleText = `HP: 0/0`;
        return `<div class="hp-bar" title="${titleText}" style="height: 12px; margin: 0px 0;"><div class="hp-fill" id="${barId}" style="width: 0%;"></div></div>`;
    }
    const hpPercentage = (pokemon.currentHp / pokemon.maxHp) * 100;
    const titleText = getPokemonHpText(pokemon);
    return `<div class="hp-bar" title="${titleText}" style="height: 12px; margin: 0px 0;"><div class="hp-fill" id="${barId}" style="width: ${hpPercentage}%;"></div></div>`;
}


export function displayPokemonDataInBattle(pokemon, elements, spriteType = 'front') {
    // This function is specifically for the main player and wild Pokémon displays in battle.
    // It assumes `elements` is an object with specific DOM element references.
    if (pokemon) {
        const isWildForCaughtCheck = pokemon === gameState.currentWildPokemon;
        elements.nameEl.innerHTML = getPokemonNameHTML(pokemon, elements.shinyIndicatorClass || 'shiny-indicator', false, isWildForCaughtCheck);

        if (elements.levelEl) {
            const typeIconsHTMLString = getTypeIconsHTML(pokemon);
            elements.levelEl.innerHTML = `${getPokemonLevelText(pokemon)}${typeIconsHTMLString ? ' ' + typeIconsHTMLString : ''}`;
        }
        elements.spriteEl.src = getPokemonSpritePath(pokemon, spriteType);
        elements.spriteEl.classList.add('zoomable-sprite');
        elements.spriteEl.alt = pokemon.nickname || pokemon.name;
        elements.spriteEl.style.cursor = 'pointer';

        // Determine what to pass to handlePokemonSpriteClick
        // For player/wild, index is effectively -1 or a special marker.
        // The original handlePokemonSpriteClick in ui.js took (index, locationType)
        // We'll need to ensure ui.js (or its new modal part) can still call the right thing.
        let clickHandlerLocationType = '';
        if (pokemon === getActivePokemon()) clickHandlerLocationType = 'player';
        else if (pokemon === gameState.currentWildPokemon) clickHandlerLocationType = 'wild';

        if (clickHandlerLocationType) {
             // The actual handlePokemonSpriteClick function will be in the main ui.js or modalDisplay.js
             // This module provides the data, but doesn't directly attach the top-level modal click handlers.
             // So, we might not set elements.spriteEl.onclick here directly if it's managed by a higher-level UI coordinator.
             // For now, we assume the modal opening is handled elsewhere based on these elements.
        }


        if (elements.hpTextEl) elements.hpTextEl.textContent = getPokemonHpText(pokemon);
        if (elements.statsEl) elements.statsEl.textContent = getPokemonStatsString(pokemon);
        if (elements.hpBarId) updateHpBarElement(elements.hpBarId, pokemon.currentHp, pokemon.maxHp); // Renamed for clarity

        elements.spriteEl.classList.toggle('shiny-pokemon', !!pokemon.isShiny);

    } else { // No Pokémon to display
        elements.nameEl.innerHTML = elements.defaultName || 'No Pokemon';
        if (elements.levelEl) elements.levelEl.textContent = '';
        elements.spriteEl.src = getPokemonSpritePath(null); // Get placeholder
        elements.spriteEl.alt = elements.defaultAlt || "No Pokemon";
        elements.spriteEl.classList.remove('zoomable-sprite', 'shiny-pokemon');
        elements.spriteEl.style.cursor = 'default';
        // elements.spriteEl.onclick = null; // Remove click listener if any
        if (elements.hpTextEl) elements.hpTextEl.textContent = getPokemonHpText(null);
        if (elements.statsEl) elements.statsEl.textContent = getPokemonStatsString(null);
        if (elements.hpBarId) updateHpBarElement(elements.hpBarId, 0, 1);
    }
}

export function updateHpBarElement(elementId, current, max) {
    // Generic HP bar updater based on element ID
    const percentage = max > 0 ? (current / max) * 100 : 0;
    const barElement = document.getElementById(elementId);
    if (barElement && barElement.classList.contains('hp-fill')) { // Make sure it's the fill element
        barElement.style.width = percentage + '%';
    } else if (barElement) { // If it's the container, find the fill
        const fill = barElement.querySelector('.hp-fill');
        if (fill) fill.style.width = percentage + '%';
    }
}

// This file will also contain updateWildPokemonDisplay and the player part of updateDisplay
// once ui.js is refactored. For now, these are the core display utility functions.
