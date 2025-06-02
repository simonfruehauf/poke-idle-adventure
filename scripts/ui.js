// ui.js
import { gameState, pokemonBaseStatsData, pokeballData, potionData, routes } from './state.js';
import { getActivePokemon, formatNumberWithDots, addBattleLog } from './utils.js';
import { POKEMON_SPRITE_BASE_URL, AUTO_FIGHT_UNLOCK_WINS, XP_SHARE_CONFIG, STARTER_POKEMON_NAMES } from './config.js';
import { Pokemon } from './pokemon.js';
import { calculateAveragePartyLevel, attemptEvolution, setActivePokemon, removeFromParty, confirmReleasePokemon as confirmReleasePokemonLogic, addToParty as addToPartyLogic } from './gameLogic.js'; // Import logic functions

// --- Utility functions for Pokémon data presentation ---
export function getPokemonNameHTML(pokemon, shinyIndicatorClass = 'shiny-indicator', showBallIcon = false) {
    if (!pokemon) return '';
    let ballIconHTML = '';
    if (showBallIcon) {
        const ballId = pokemon.caughtWithBall || 'pokeball';
        const ballInfo = pokeballData[ballId] || pokeballData.pokeball; // Use pokeballData
        ballIconHTML = `<img src="${ballInfo.image}" alt="${ballInfo.name}" title="${ballInfo.name}" class="inline-ball-icon"> `;
    }
    const shinySpan = pokemon.isShiny ? ` <span class="${shinyIndicatorClass}">(Shiny)</span>` : '';
    return `${ballIconHTML}${pokemon.name}${shinySpan}`;}

export function getPokemonSpritePath(pokemon, spriteType = 'front', baseSpriteUrl = POKEMON_SPRITE_BASE_URL) {
    if (!pokemon || !pokemon.pokedexId) return "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="; // Placeholder
    return `${baseSpriteUrl}${spriteType}/${pokemon.isShiny ? 'shiny/' : ''}${pokemon.pokedexId}.png`;
}

export function getPokemonLevelText(pokemon) { // Used for player/wild display (e.g., :L5)
    if (!pokemon || typeof pokemon.level === 'undefined') return '';
    return `:L${pokemon.level}`;
}

export function getPokemonFullLevelText(pokemon) { // Used for party/storage display (e.g., Lv.5)
    if (!pokemon || typeof pokemon.level === 'undefined') return '';
    return `Lv.${pokemon.level}`;
}

export function getPokemonHpText(pokemon) {
    if (!pokemon) return 'HP: 0/0';
    return `HP: ${pokemon.currentHp}/${pokemon.maxHp}`;
}

export function getPokemonStatsString(pokemon) { // For player/wild display
    if (!pokemon) return 'ATK: 0 | DEF: 0 | SPD: 0';
    return `ATK: ${pokemon.attack} | DEF: ${pokemon.defense} | SPD: ${pokemon.speed}`;
}

export function getPokemonDetailedStatsHTML(pokemon) { // For party/storage display
    if (!pokemon) return '';
    return `
        <div class="pokemon-detailed-stats">HP: ${pokemon.currentHp}/${pokemon.maxHp} | SPD: ${pokemon.speed}</div>
        <div class="pokemon-detailed-stats">ATK: ${pokemon.attack} | DEF: ${pokemon.defense} </div>
    `;
}

export function getPokemonExpBarHTML(pokemon) {
    if (!pokemon || typeof pokemon.exp !== 'number' || typeof pokemon.expToNext !== 'number' || pokemon.expToNext === 0) {
        return '<div class="pokemon-exp" style="height: 8px; margin: 5px 0;"><div class="exp-fill" style="width: 0%"></div></div>';
    }
    const expPercentage = (pokemon.exp / pokemon.expToNext) * 100;
    return `<div class="pokemon-exp" style="height: 8px; margin: 5px 0;"><div class="exp-fill" style="width: ${expPercentage}%"></div></div>`;
}
// --- End of utility functions ---

// Helper function to update general player stats display
function _updatePlayerStatsDisplay() {
    const uniqueSpecies = new Set();
    const uniqueShinySpecies = new Set();
    const allPlayerPokemon = [...gameState.party.filter(p => p), ...gameState.allPokemon.filter(p => p)];

    allPlayerPokemon.forEach(pokemon => {
        if (pokemon.pokedexId) {
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
    document.getElementById('pokedex-count').textContent = pokedexText;
    document.getElementById('battle-wins').textContent = gameState.battleWins;
    document.getElementById('money').textContent = formatNumberWithDots(gameState.money) + "₽";
    document.getElementById('pokeballs-standard').textContent = gameState.pokeballs.pokeball;
    document.getElementById('pokeballs-great').textContent = gameState.pokeballs.greatball;
    document.getElementById('pokeballs-ultra').textContent = gameState.pokeballs.ultraball;

    // Update general player stats display for Master Balls (e.g., top-left stats)
    const masterballPlayerStatSpan = document.getElementById('pokeballs-master');
    if (masterballPlayerStatSpan) {
        masterballPlayerStatSpan.textContent = gameState.pokeballs.masterball;
    }

    // Update item bar display for Master Balls
    const masterballItemBarContainer = document.getElementById('itembar-display-masterball'); // The DIV container in the item bar
    const masterballItemBarCountSpan = document.getElementById('itembar-masterball-count');   // The SPAN for the count within the item bar

    if (masterballItemBarContainer) {
        if (gameState.pokeballs.masterball > 0) {
            masterballItemBarContainer.style.display = ''; // Show the container (CSS default like 'flex', 'inline-block')
            if (masterballItemBarCountSpan) {
                masterballItemBarCountSpan.textContent = gameState.pokeballs.masterball;
            }
        } else {
            masterballItemBarContainer.style.display = 'none'; // Hide the container
            if (masterballItemBarCountSpan) { // Also update count to 0 for consistency, though hidden
                masterballItemBarCountSpan.textContent = '0';
            }
        }
    }

    if (document.getElementById('potions-potion')) document.getElementById('potions-potion').textContent = gameState.potions.potion;
    if (document.getElementById('potions-hyperpotion')) document.getElementById('potions-hyperpotion').textContent = gameState.potions.hyperpotion;
    if (document.getElementById('potions-moomoomilk')) document.getElementById('potions-moomoomilk').textContent = gameState.potions.moomoomilk;
}

// Helper function to update main action buttons (Fight, Catch, Auto-Fight, Route)
function _updateMainActionButtonsState() {
    const fightBtn = document.getElementById('fight-btn');
    const catchPokeballBtn = document.getElementById('catch-pokeball-btn');
    const catchGreatballBtn = document.getElementById('catch-greatball-btn');
    const catchUltraballBtn = document.getElementById('catch-ultraball-btn');
    const catchMasterballBtn = document.getElementById('catch-masterball-btn');
    const autoFightBtn = document.getElementById('auto-fight-btn');
    const freeHealBtn = document.getElementById('free-heal-btn');

    const routeSelectContainer = document.getElementById('route-select-container');
    const leaveRouteBtn = document.getElementById('leave-route-btn');

    const activePokemon = getActivePokemon();
    const playerCanInitiateAction = activePokemon && activePokemon.currentHp > 0;

    if (gameState.currentRoute === null) {
        fightBtn.textContent = "Select a Route";
        fightBtn.disabled = true;
        if (routeSelectContainer) routeSelectContainer.style.display = '';
        if (leaveRouteBtn) leaveRouteBtn.style.display = 'none';
    } else {
        fightBtn.textContent = gameState.currentWildPokemon ? "Fight!" : "Find Pokémon";
        fightBtn.disabled = gameState.battleInProgress || gameState.autoBattleActive || !playerCanInitiateAction;
        if (routeSelectContainer) routeSelectContainer.style.display = 'none';
        if (leaveRouteBtn) {
            leaveRouteBtn.style.display = '';
            leaveRouteBtn.disabled = gameState.battleInProgress || gameState.autoBattleActive;
        }
    }

    const canCatch = gameState.currentWildPokemon && gameState.currentWildPokemon.currentHp > 0 && !gameState.battleInProgress && !gameState.autoBattleActive;
    
    if (catchPokeballBtn) {
        catchPokeballBtn.disabled = !canCatch || gameState.pokeballs.pokeball <= 0;
        catchPokeballBtn.style.display = gameState.pokeballs.pokeball > 0 ? '' : 'none';
    }
    if (catchGreatballBtn) {
        catchGreatballBtn.disabled = !canCatch || gameState.pokeballs.greatball <= 0;
        catchGreatballBtn.style.display = gameState.pokeballs.greatball > 0 ? '' : 'none';
    }
    if (catchUltraballBtn) {
        catchUltraballBtn.disabled = !canCatch || gameState.pokeballs.ultraball <= 0;
        catchUltraballBtn.style.display = gameState.pokeballs.ultraball > 0 ? '' : 'none';
    }
    if (catchMasterballBtn) {
        catchMasterballBtn.disabled = !canCatch || gameState.pokeballs.masterball <= 0;
        catchMasterballBtn.style.display = gameState.pokeballs.masterball > 0 ? '' : 'none';
    }

    if (pokeballData.pokeball && catchPokeballBtn && gameState.pokeballs.pokeball > 0) {
        catchPokeballBtn.textContent = `Catch (${pokeballData.pokeball.name} - ${gameState.pokeballs.pokeball})`;
    }
    if (pokeballData.greatball && catchGreatballBtn && gameState.pokeballs.greatball > 0) {
        catchGreatballBtn.textContent = `Catch (${pokeballData.greatball.name} - ${gameState.pokeballs.greatball})`;
    }
    if (pokeballData.ultraball && catchUltraballBtn && gameState.pokeballs.ultraball > 0) {
        catchUltraballBtn.textContent = `Catch (${pokeballData.ultraball.name} - ${gameState.pokeballs.ultraball})`;
    }
    if (pokeballData.masterball && catchMasterballBtn) {
        if (gameState.pokeballs.masterball > 0) {
            catchMasterballBtn.textContent = `Catch (${pokeballData.masterball.name} - ${gameState.pokeballs.masterball})`;
        }
    }

    if (!gameState.autoFightUnlocked) {
        autoFightBtn.textContent = `Auto-Fight (LOCKED - ${AUTO_FIGHT_UNLOCK_WINS} wins)`;
        autoFightBtn.disabled = true;
        autoFightBtn.style.backgroundColor = "#aaa";
    } else {
        if (gameState.autoBattleActive) {
            // If auto-fight is ON, button says "Stop Auto-Fight" and should ALWAYS be enabled.
            autoFightBtn.textContent = 'Stop Auto-Fight';
            autoFightBtn.disabled = false;
        } else {
            // If auto-fight is OFF, button says "Start Auto-Fight".
            // Disable "Start Auto-Fight" if:
            // 1. Auto-fight is not unlocked OR
            // 2. No route is selected OR
            // 3. A battle is currently in progress (can't start a new auto-fight then).
            autoFightBtn.textContent = 'Start Auto-Fight';
            autoFightBtn.disabled = !gameState.autoFightUnlocked || 
                                       gameState.currentRoute === null || 
                                       gameState.battleInProgress;
        }
    }
    // Free Heal Button
    if (freeHealBtn) {
        const hasNoMoomooMilk = (gameState.potions.moomoomilk || 0) === 0;
        const hasNoHyperPotion = (gameState.potions.hyperpotion || 0) === 0;
        const canShowFreeHeal = gameState.money < 800 && (hasNoMoomooMilk && hasNoHyperPotion) && !gameState.battleInProgress && gameState.currentRoute === null; 
        freeHealBtn.disabled = !canShowFreeHeal;

        if (canShowFreeHeal) {
            freeHealBtn.style.display = ''; // Or 'inline-block' or 'block' depending on layout
        } 
    }
}

// Helper function to update shop related UI elements
function _updateShopInterface() {
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

    for (const ballId in pokeballData) {
        const ballInfo = pokeballData[ballId];
        const shopItemEl = document.getElementById(`shop-item-${ballId}`);
        if (shopItemEl && ballInfo) {
            const nameSpan = shopItemEl.querySelector('span');
            if (nameSpan) nameSpan.textContent = `${ballInfo.name} (x1)`;
            const buyButton = shopItemEl.querySelector(`button[onclick="buyBall('${ballId}', 1)"]`);
            if (buyButton && typeof ballInfo.cost === 'number') buyButton.textContent = `Buy - ${formatNumberWithDots(ballInfo.cost)}₽`;
            const tooltipEl = document.getElementById(`tooltip-shop-item-${ballId}`);
            if (tooltipEl) tooltipEl.textContent = ballInfo.description || ballInfo.name;
        }
    }
    for (const potionId in potionData) {
        const potionInfo = potionData[potionId];
        const shopItemEl = document.getElementById(`shop-item-${potionId}`);
        if (shopItemEl && potionInfo) {
            const nameSpan = shopItemEl.querySelector('span');
            if (nameSpan) nameSpan.textContent = `${potionInfo.name} (x1)`;
            const buyButton = shopItemEl.querySelector(`button[onclick="buyPotion('${potionId}', 1)"]`);
            if (buyButton && typeof potionInfo.cost === 'number') buyButton.textContent = `Buy - ${formatNumberWithDots(potionInfo.cost)}₽`;
            const tooltipEl = document.getElementById(`tooltip-shop-item-${potionId}`);
            if (tooltipEl) tooltipEl.textContent = potionInfo.description || potionInfo.name;
        }
    }
}

// Helper function to update item bar tooltips
function _updateItemBarTooltips() {
    const itemDisplayElements = document.querySelectorAll('.items-bar .item-display');
    itemDisplayElements.forEach(itemEl => {
        let description = '';
        let tooltipEl = null;
        if (itemEl.querySelector('#pokeballs-standard')) {
            tooltipEl = document.getElementById('tooltip-itembar-pokeball');
            if (pokeballData.pokeball) description = pokeballData.pokeball.description || pokeballData.pokeball.name;
        } else if (itemEl.querySelector('#pokeballs-great')) {
            tooltipEl = document.getElementById('tooltip-itembar-greatball');
            if (pokeballData.greatball) description = pokeballData.greatball.description || pokeballData.greatball.name;
        } else if (itemEl.querySelector('#pokeballs-ultra')) {
            tooltipEl = document.getElementById('tooltip-itembar-ultraball');
            if (pokeballData.ultraball) description = pokeballData.ultraball.description || pokeballData.ultraball.name;
        } else if (itemEl.querySelector('#pokeballs-master')) {
            tooltipEl = document.getElementById('tooltip-itembar-masterball');
            if (pokeballData.masterball) description = pokeballData.masterball.description || pokeballData.masterball.name;
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
        if (tooltipEl && description) tooltipEl.textContent = description;
    });
}

// Helper function to update potion use buttons
function _updatePotionUseButtons() {
    const usePotionBtn = document.getElementById('use-potion-btn');
    const useHyperPotionBtn = document.getElementById('use-hyperpotion-btn');
    const useMoomooMilkBtn = document.getElementById('use-moomoomilk-btn');
    const canUseItem = !gameState.battleInProgress;
    const activePokemon = getActivePokemon();

    if (usePotionBtn) {
        const activePokemonNeedsPotion = activePokemon && activePokemon.currentHp > 0 && activePokemon.currentHp < activePokemon.maxHp;
        usePotionBtn.disabled = !canUseItem || !activePokemonNeedsPotion || gameState.potions.potion <= 0;
        usePotionBtn.style.display = gameState.potions.potion > 0 ? '' : 'none';
        usePotionBtn.textContent = `Use Potion (${gameState.potions.potion})`;
    }
    if (useHyperPotionBtn) {
        const activePokemonNeedsHyperPotion = activePokemon && activePokemon.currentHp > 0 && activePokemon.currentHp < activePokemon.maxHp;
        useHyperPotionBtn.disabled = !canUseItem || !activePokemonNeedsHyperPotion || gameState.potions.hyperpotion <= 0;
        useHyperPotionBtn.style.display = gameState.potions.hyperpotion > 0 ? '' : 'none';
        useHyperPotionBtn.textContent = `Use Hyper Potion (${gameState.potions.hyperpotion})`;
    }
    if (useMoomooMilkBtn) {
        const partyNeedsHealing = gameState.party.some(p => p && p.currentHp > 0 && p.currentHp < p.maxHp);
        useMoomooMilkBtn.disabled = !canUseItem || !partyNeedsHealing || gameState.potions.moomoomilk <= 0;
        useMoomooMilkBtn.style.display = gameState.potions.moomoomilk > 0 ? '' : 'none';
        useMoomooMilkBtn.textContent = `Use Moomoo Milk (${gameState.potions.moomoomilk})`;
    }
}

export function updateDisplay() {
    _updatePlayerStatsDisplay();
    _updateMainActionButtonsState();
    _updateShopInterface();
    _updateItemBarTooltips();
    _updatePotionUseButtons();

    const playerElements = {
        nameEl: document.getElementById('player-name'),
        levelEl: document.getElementById('player-level'),
        spriteEl: document.getElementById('player-sprite'),
        hpTextEl: document.getElementById('player-hp-text'),
        hpBarId: 'player-hp',
        statsEl: document.getElementById('player-stats'),
        defaultName: 'No Pokemon',
        defaultAlt: 'No active Pokemon'
    };
    const activePokemon = getActivePokemon();
    displayPokemonData(activePokemon, playerElements, 'back');

    updateWildPokemonDisplay();
    updatePartyDisplay();
    updateStorageDisplay();
}

export function displayPokemonData(pokemon, elements, spriteType = 'front') {
    if (pokemon) {
        elements.nameEl.innerHTML = getPokemonNameHTML(pokemon, elements.shinyIndicatorClass, false);
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
        elements.spriteEl.src = getPokemonSpritePath(null);
        elements.spriteEl.alt = elements.defaultAlt || "No Pokemon";
        if (elements.hpTextEl) elements.hpTextEl.textContent = getPokemonHpText(null);
        if (elements.statsEl) elements.statsEl.textContent = getPokemonStatsString(null);
        if (elements.hpBarId) updateHpBar(elements.hpBarId, 0, 1);
        elements.spriteEl.classList.remove('shiny-pokemon');
    }
}

export function updateWildPokemonDisplay() {
    const wildPokemonContainer = document.getElementById('wild-pokemon');
    const wildPokemonInfoDiv = wildPokemonContainer.querySelector('.pokemon-info');
    const wildSprite = document.getElementById('wild-sprite');

    wildPokemonContainer.style.display = '';
    wildPokemonContainer.style.visibility = 'visible';

    const wildElements = {
        nameEl: document.getElementById('wild-name'),
        levelEl: document.getElementById('wild-level'),
        spriteEl: wildSprite,
        hpTextEl: document.getElementById('wild-hp-text'),
        hpBarId: 'wild-hp',
        statsEl: document.getElementById('wild-stats'),
    };

    if (gameState.currentWildPokemon) {
        if (wildPokemonInfoDiv) wildPokemonInfoDiv.style.visibility = 'visible';
        wildSprite.style.visibility = 'visible';
        displayPokemonData(gameState.currentWildPokemon, wildElements, 'front');
    } else {
        if (wildPokemonInfoDiv) wildPokemonInfoDiv.style.visibility = 'hidden';
        wildSprite.style.visibility = 'hidden';
        displayPokemonData(null, wildElements, 'front');
    }
}

export function generatePokemonListItemHTML(pokemon, index, locationType) {
    if (!pokemon) {
        if (locationType === 'party') return '<div style="color: #ccc;">Empty Slot</div>';
        return '';
    }

    const shinyClass = pokemon.isShiny ? 'shiny-pokemon' : '';
    const spritePath = getPokemonSpritePath(pokemon, 'front');
    let evolveButtonHtml = '';
    if (pokemon.evolutionTargetName && pokemon.evolveLevel && pokemon.level >= pokemon.evolveLevel) {
        const onclickAction = locationType === 'party' ? `window.attemptEvolution(${index}, 'party')` : `event.stopPropagation(); window.attemptEvolution(${index}, 'storage')`;
        evolveButtonHtml = `<button class="btn small" onclick="${onclickAction}" style="background: #ffc107; color: #333; margin-left: 5px;">Evolve</button>`;
    }

    let controlsHtml = '';
    if (locationType === 'party') {
        const isActive = gameState.activePokemonIndex === index;
        controlsHtml = `
            <div class="controls" style="margin-top: 8px;">
                <button class="btn small ${isActive ? 'secondary' : ''}" 
                        onclick="window.setActivePokemon(${index})" 
                        ${pokemon.currentHp <= 0 ? 'disabled' : ''}>
                    ${isActive ? 'Active' : 'Select'}
                </button>
                <button class="btn small" onclick="window.removeFromParty(${index})" style="background: #f44336;">
                    Remove
                </button>
                ${evolveButtonHtml}
            </div>`;
    } else { // storage
        controlsHtml = `
            <div class="controls" style="margin-top: 8px; clear:both;">
                <button class="btn small secondary" onclick="event.stopPropagation(); window.addToPartyDialog(${index})">
                    Add to Party
                </button>
                <button class="btn small" onclick="event.stopPropagation(); window.confirmReleasePokemon(${index})" style="background: #dc3545; margin-left: 5px;">
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
        return cardContent;
    } else {
        return `<div class="pokemon-card">${cardContent}</div>`;
    }
}

export function updatePartyDisplay() {
    for (let i = 0; i < 6; i++) {
        const slot = document.getElementById(`party-${i}`);
        const pokemon = gameState.party[i];
        if (pokemon) {
            slot.classList.add('filled');
            slot.innerHTML = generatePokemonListItemHTML(pokemon, i, 'party');
        } else {
            slot.classList.remove('filled');
            slot.innerHTML = generatePokemonListItemHTML(null, i, 'party');
        }
    }
}

export function updateStorageDisplay() {
    const storageList = document.getElementById('team-list');
    if (gameState.allPokemon.length === 0) {
        storageList.innerHTML = `<div style="text-align: center; color: #ccc; margin-top: 50px;">No Pokemon in storage!</div>`;
        return;
    }
    storageList.innerHTML = gameState.allPokemon
        .map((pokemon, index) => generatePokemonListItemHTML(pokemon, index, 'storage'))
        .join('');
}

export function updateHpBar(id, current, max) {
    const percentage = max > 0 ? (current / max) * 100 : 0;
    const barElement = document.getElementById(id);
    if (barElement) {
        barElement.style.width = percentage + '%';
    }
}

export async function showStarterSelectionModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('starter-modal');
        const optionsContainer = modal.querySelector('.starter-options');
        optionsContainer.innerHTML = ''; 

        STARTER_POKEMON_NAMES.forEach(name => {
            const pkmnData = pokemonBaseStatsData[name];
            if (!pkmnData) {
                console.warn(`Starter Pokemon ${name} not found in statmap.`);
                return;
            }
            const optionDiv = document.createElement('div');
            optionDiv.className = 'starter-option';
            const spriteUrl = pkmnData.pokedexId ? `${POKEMON_SPRITE_BASE_URL}front/${pkmnData.pokedexId}.png` : "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
            optionDiv.innerHTML = `
                <img src="${spriteUrl}" alt="${name}">
                <div class="pokemon-name">${name}</div>
            `;
            optionDiv.onclick = () => {
                const starterPokemon = new Pokemon(name, 5);
                gameState.party[0] = starterPokemon;
                gameState.activePokemonIndex = 0;
                addBattleLog(`You chose ${name} as your starter Pokémon!`);
                modal.style.display = 'none';
                resolve();
            };
            optionsContainer.appendChild(optionDiv);
        });
        modal.style.display = 'flex';
    });
}

export function addToPartyDialog(storageIndex) {
    const availableSlots = [];
    for (let i = 0; i < 6; i++) {
        if (gameState.party[i] === null) {
            availableSlots.push(i);
        }
    }
    if (availableSlots.length === 0) {
        const slotChoice = prompt("Party is full! Which slot to replace? (1-6, or cancel)");
        const slot = parseInt(slotChoice) - 1;
        if (slot >= 0 && slot < 6) {
            addToPartyLogic(storageIndex, slot);
        }
    } else {
        addToPartyLogic(storageIndex, availableSlots[0]);
    }
}

export function confirmReleasePokemon(storageIndex) {
    confirmReleasePokemonLogic(storageIndex);
}

export function populateRouteSelector() {
    const routeSelect = document.getElementById('route-select');
    if (!routeSelect) return;

    const currentAvgLevel = calculateAveragePartyLevel();
    routeSelect.innerHTML = ''; 

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