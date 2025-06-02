// ui.js
import { gameState, pokemonBaseStatsData, pokeballData, itemData, routes } from './state.js';
import { getActivePokemon, formatNumberWithDots, addBattleLog } from './utils.js';
import { POKEMON_SPRITE_BASE_URL, AUTO_FIGHT_UNLOCK_WINS, XP_SHARE_CONFIG, STARTER_POKEMON_NAMES, SHINY_CHANCE } from './config.js'; // SHINY_CHANCE might not be directly used here but good to keep track of config imports
import { Pokemon } from './pokemon.js';
import { calculateAveragePartyLevel, attemptEvolution, setActivePokemon, removeFromParty, confirmReleasePokemon as confirmReleasePokemonLogic, addToParty as addToPartyLogic } from './gameLogic.js'; // Import logic functions

// --- Utility functions for Pokémon data presentation ---
export function getPokemonNameHTML(pokemon, shinyIndicatorClass = 'shiny-indicator', showBallIcon = false, checkCaughtStatus = false) {
    if (!pokemon) return '';
    let ballIconHTML = '';
    if (showBallIcon) {
        const ballId = pokemon.caughtWithBall || 'pokeball';
        const ballInfo = pokeballData[ballId] || pokeballData.pokeball; // Use pokeballData
        ballIconHTML = `<img src="${ballInfo.image}" alt="${ballInfo.name}" title="${ballInfo.name}" class="inline-ball-icon"> `;
    }
    const shinySpan = pokemon.isShiny ? ` <span class="${shinyIndicatorClass}">(Shiny)</span>` : '';
    let caughtIndicatorHTML = '';
    if (checkCaughtStatus && pokemon.pokedexId) {
        // Determine if the player has caught this species
        const isCaught = gameState.party.some(p => p && p.pokedexId === pokemon.pokedexId) ||
                         gameState.allPokemon.some(p => p && p.pokedexId === pokemon.pokedexId);
        
        const pokeballImageSrc = pokeballData.pokeball?.image; // Use the standard Pokeball image for the indicator
        const titleText = isCaught ? 'Caught' : 'Not Caught';

        if (pokeballImageSrc) {
            // Always show the icon if its image source is available.
            // The 'caught-indicator-icon' class applies default grayscale.
            // The 'is-caught' class will be added if the Pokemon is caught, removing the grayscale.
            const caughtClass = isCaught ? ' is-caught' : ''; // Add a leading space for the additional class
            caughtIndicatorHTML = `<img src="${pokeballImageSrc}" alt="Caught Status" title="${titleText}" class="caught-indicator-icon${caughtClass}"> `;
        } else {
            // Fallback to text indicator if the icon's image source is missing.
            // Show text only if caught, to maintain consistency with the original fallback behavior.
            if (isCaught) caughtIndicatorHTML = `<span class="caught-indicator-text" title="Caught">(C)</span> `;
        }
    }
    return `${caughtIndicatorHTML}${ballIconHTML}${pokemon.name}${shinySpan}`;}

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

    // Helper to manage visibility and count update for item bar items
    function setItemBarDisplay(itemId, count, alwaysShow = false) {
        let containerElement;
        let countElementId;
        let itemTitleForQuery; // Used for items that don't have a direct container ID

        switch (itemId) {
            case 'pokeball':
                itemTitleForQuery = 'Poké Balls';
                countElementId = 'pokeballs-standard';
                break;
            case 'greatball':
                itemTitleForQuery = 'Great Balls';
                countElementId = 'pokeballs-great';
                break;
            case 'ultraball':
                itemTitleForQuery = 'Ultra Balls';
                countElementId = 'pokeballs-ultra';
                break;
            case 'masterball':
                containerElement = document.getElementById('itembar-display-masterball');
                countElementId = 'itembar-masterball-count';
                break;
            default: // For items like potion, firestone, etc.
                // Ensure itemData is loaded and the item exists to get its name for the title attribute
                itemTitleForQuery = itemData[itemId] ? itemData[itemId].name : itemId.charAt(0).toUpperCase() + itemId.slice(1);
                countElementId = `item-count-${itemId}`;
                break;
        }

        if (itemTitleForQuery && !containerElement) {
            // Try to find container using title attribute if not already found (e.g. for masterball)
            containerElement = document.querySelector(`.items-bar .item-display[title="${itemTitleForQuery}"]`);
        }

        if (!containerElement && countElementId) { // Fallback if title-based query fails, try via count span
            const countSpan = document.getElementById(countElementId);
            if (countSpan) containerElement = countSpan.closest('.item-display');
        }

        if (containerElement) {
            const countSpan = document.getElementById(countElementId);
            if (countSpan) {
                countSpan.textContent = count;
            }

            if (alwaysShow || count > 0) {
                containerElement.style.display = ''; // Reverts to CSS default (e.g., flex)
            } else {
                containerElement.style.display = 'none';
            }
        }
    }

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

    // Update item bar displays using the helper
    setItemBarDisplay('pokeball', gameState.pokeballs.pokeball, true); // Always show Poké Balls
    setItemBarDisplay('greatball', gameState.pokeballs.greatball);
    setItemBarDisplay('ultraball', gameState.pokeballs.ultraball);
    setItemBarDisplay('masterball', gameState.pokeballs.masterball);

    setItemBarDisplay('potion', gameState.items.potion || 0);
    setItemBarDisplay('hyperpotion', gameState.items.hyperpotion || 0);
    setItemBarDisplay('moomoomilk', gameState.items.moomoomilk || 0);
    setItemBarDisplay('firestone', gameState.items.firestone || 0);
    setItemBarDisplay('waterstone', gameState.items.waterstone || 0);
    setItemBarDisplay('thunderstone', gameState.items.thunderstone || 0);
    setItemBarDisplay('moonstone', gameState.items.moonstone || 0);
    setItemBarDisplay('leafstone', gameState.items.leafstone || 0);
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
        const hasNoMoomooMilk = (gameState.items.moomoomilk || 0) === 0; // Renamed from gameState.potions
        const hasNoHyperPotion = (gameState.items.hyperpotion || 0) === 0; // Renamed from gameState.potions
        const canShowFreeHeal = gameState.money < 800 && (hasNoMoomooMilk && hasNoHyperPotion) && !gameState.battleInProgress && gameState.currentRoute === null; 

        if (canShowFreeHeal) {
            freeHealBtn.style.display = ''; // Or 'inline-block' or 'block' depending on layout
            freeHealBtn.disabled = false;
        } else {
            freeHealBtn.style.display = 'none';
            freeHealBtn.disabled = true;
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
    for (const itemId in itemData) { // Renamed from potionId, potionData
        const itemInfo = itemData[itemId]; // Renamed from potionInfo
        const shopItemEl = document.getElementById(`shop-item-${itemId}`);
        if (shopItemEl && itemInfo) {
            const nameSpan = shopItemEl.querySelector('span');
            if (nameSpan) nameSpan.textContent = `${itemInfo.name} (x1)`;
            const buyButton = shopItemEl.querySelector(`button[onclick="buyItem('${itemId}', 1)"]`); // Renamed buyPotion to buyItem
            if (buyButton && typeof itemInfo.cost === 'number') buyButton.textContent = `Buy - ${formatNumberWithDots(itemInfo.cost)}₽`;
            const tooltipEl = document.getElementById(`tooltip-shop-item-${itemId}`);
            if (tooltipEl) tooltipEl.textContent = itemInfo.description || itemInfo.name;
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
        } else if (itemEl.querySelector('#item-count-potion')) { // Renamed ID
            tooltipEl = document.getElementById('tooltip-itembar-potion'); // Assuming tooltip ID remains based on item ID
            if (itemData.potion) description = itemData.potion.description || itemData.potion.name; // Renamed potionData
        } else if (itemEl.querySelector('#item-count-hyperpotion')) { // Renamed ID
            tooltipEl = document.getElementById('tooltip-itembar-hyperpotion');
            if (itemData.hyperpotion) description = itemData.hyperpotion.description || itemData.hyperpotion.name; // Renamed potionData
        } else if (itemEl.querySelector('#item-count-moomoomilk')) { // Renamed ID
            tooltipEl = document.getElementById('tooltip-itembar-moomoomilk');
            if (itemData.moomoomilk) description = itemData.moomoomilk.description || itemData.moomoomilk.name; // Renamed potionData
        } else if (itemEl.querySelector('#item-count-firestone')) {
            tooltipEl = document.getElementById('tooltip-itembar-firestone');
            if (itemData.firestone) description = itemData.firestone.description || itemData.firestone.name;
        } else if (itemEl.querySelector('#item-count-waterstone')) {
            tooltipEl = document.getElementById('tooltip-itembar-waterstone');
            if (itemData.waterstone) description = itemData.waterstone.description || itemData.waterstone.name;
        } else if (itemEl.querySelector('#item-count-thunderstone')) {
            tooltipEl = document.getElementById('tooltip-itembar-thunderstone');
            if (itemData.thunderstone) description = itemData.thunderstone.description || itemData.thunderstone.name;
        } else if (itemEl.querySelector('#item-count-moonstone')) {
            tooltipEl = document.getElementById('tooltip-itembar-moonstone');
            if (itemData.moonstone) description = itemData.moonstone.description || itemData.moonstone.name;
        } else if (itemEl.querySelector('#item-count-leafstone')) {
            tooltipEl = document.getElementById('tooltip-itembar-leafstone');
            if (itemData.leafstone) description = itemData.leafstone.description || itemData.leafstone.name;
        }
        if (tooltipEl && description) tooltipEl.textContent = description;
    });
}

// Helper function to update potion use buttons
function _updateItemUseButtons() { // Renamed from _updatePotionUseButtons
    const usePotionBtn = document.getElementById('use-item-potion-btn'); // Renamed ID
    const useHyperPotionBtn = document.getElementById('use-item-hyperpotion-btn'); // Renamed ID
    const useMoomooMilkBtn = document.getElementById('use-item-moomoomilk-btn'); // Renamed ID
    const useFireStoneBtn = document.getElementById('use-item-firestone-btn');
    const useWaterStoneBtn = document.getElementById('use-item-waterstone-btn');
    const useThunderStoneBtn = document.getElementById('use-item-thunderstone-btn');
    const useMoonStoneBtn = document.getElementById('use-item-moonstone-btn');
    const useLeafStoneBtn = document.getElementById('use-item-leafstone-btn');
    const canUseItem = !gameState.battleInProgress;
    const activePokemon = getActivePokemon();

    if (usePotionBtn) {
        const activePokemonNeedsPotion = activePokemon && activePokemon.currentHp > 0 && activePokemon.currentHp < activePokemon.maxHp;
        usePotionBtn.disabled = !canUseItem || !activePokemonNeedsPotion || gameState.items.potion <= 0; // Renamed gameState.potions
        usePotionBtn.style.display = gameState.items.potion > 0 ? '' : 'none'; // Renamed gameState.potions
        usePotionBtn.textContent = `Use Potion (${gameState.items.potion})`; // Renamed gameState.potions
    }
    if (useHyperPotionBtn) {
        const activePokemonNeedsHyperPotion = activePokemon && activePokemon.currentHp > 0 && activePokemon.currentHp < activePokemon.maxHp;
        useHyperPotionBtn.disabled = !canUseItem || !activePokemonNeedsHyperPotion || gameState.items.hyperpotion <= 0; // Renamed gameState.potions
        useHyperPotionBtn.style.display = gameState.items.hyperpotion > 0 ? '' : 'none'; // Renamed gameState.potions
        useHyperPotionBtn.textContent = `Use Hyper Potion (${gameState.items.hyperpotion})`; // Renamed gameState.potions
    }
    if (useMoomooMilkBtn) {
        const partyNeedsHealing = gameState.party.some(p => p && p.currentHp > 0 && p.currentHp < p.maxHp);
        useMoomooMilkBtn.disabled = !canUseItem || !partyNeedsHealing || gameState.items.moomoomilk <= 0; // Changed gameState.potions to gameState.items
        useMoomooMilkBtn.style.display = gameState.items.moomoomilk > 0 ? '' : 'none'; // Changed gameState.potions to gameState.items
        useMoomooMilkBtn.textContent = `Use Moomoo Milk (${gameState.items.moomoomilk})`; // Changed gameState.potions to gameState.items
    }

    // Evolution Stones
    const evolutionStoneLogic = (btn, itemId) => {
        if (!btn) return;
        let canEvolvePokemon = false;
        if (activePokemon && itemData[itemId] && itemData[itemId].evolutionTargets) {
            canEvolvePokemon = itemData[itemId].evolutionTargets.some(target => target.pokemon === activePokemon.name);
        }
        const hasItem = (gameState.items[itemId] || 0) > 0;
        btn.disabled = !canUseItem || !hasItem || !activePokemon || !canEvolvePokemon;
        btn.style.display = hasItem ? '' : 'none';
        btn.textContent = `Use ${itemData[itemId] ? itemData[itemId].name : 'Stone'} (${gameState.items[itemId] || 0})`;
    };

    if (useFireStoneBtn && itemData.firestone) {
        evolutionStoneLogic(useFireStoneBtn, 'firestone');
    } else if (useFireStoneBtn) { // Hide if itemData not loaded yet
        useFireStoneBtn.style.display = 'none';
    }
    if (useWaterStoneBtn && itemData.waterstone) {
        evolutionStoneLogic(useWaterStoneBtn, 'waterstone');
    } else if (useWaterStoneBtn) {
        useWaterStoneBtn.style.display = 'none';
    }
    if (useThunderStoneBtn && itemData.thunderstone) {
        evolutionStoneLogic(useThunderStoneBtn, 'thunderstone');
    } else if (useThunderStoneBtn) {
        useThunderStoneBtn.style.display = 'none';
    }
    if (useMoonStoneBtn && itemData.moonstone) {
        evolutionStoneLogic(useMoonStoneBtn, 'moonstone');
    } else if (useMoonStoneBtn) {
        useMoonStoneBtn.style.display = 'none';
    }
    if (useLeafStoneBtn && itemData.leafstone) {
        evolutionStoneLogic(useLeafStoneBtn, 'leafstone');
    } else if (useLeafStoneBtn) {
        useLeafStoneBtn.style.display = 'none';
    }
}

export function updateDisplay() {
    _updatePlayerStatsDisplay();
    _updateMainActionButtonsState();
    _updateShopInterface();
    _updateItemBarTooltips();
    _updateItemUseButtons(); // Renamed from _updatePotionUseButtons

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
        const isWildForCaughtCheck = pokemon === gameState.currentWildPokemon;
        elements.nameEl.innerHTML = getPokemonNameHTML(pokemon, elements.shinyIndicatorClass || 'shiny-indicator', false, isWildForCaughtCheck);
        if (elements.levelEl) elements.levelEl.textContent = getPokemonLevelText(pokemon);
        elements.spriteEl.src = getPokemonSpritePath(pokemon, spriteType);
        elements.spriteEl.classList.add('zoomable-sprite'); // Add zoomable class
        elements.spriteEl.alt = pokemon.name;
        elements.spriteEl.style.cursor = 'pointer'; // Indicate clickable
        if (pokemon === getActivePokemon()) {
            elements.spriteEl.onclick = () => window.handlePokemonSpriteClick(-1, 'player');
        } else if (pokemon === gameState.currentWildPokemon) {
            elements.spriteEl.onclick = () => window.handlePokemonSpriteClick(-1, 'wild');
        } else {
            elements.spriteEl.onclick = null; // Should not happen with this function's typical use
        }
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
        elements.spriteEl.classList.remove('zoomable-sprite'); // Remove zoomable class
        if (elements.hpTextEl) elements.hpTextEl.textContent = getPokemonHpText(null);
        if (elements.statsEl) elements.statsEl.textContent = getPokemonStatsString(null);
        if (elements.hpBarId) updateHpBar(elements.hpBarId, 0, 1);
        elements.spriteEl.style.cursor = 'default';
        elements.spriteEl.onclick = null;
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
        // Stop propagation for evolve button in storage to prevent card click if any other listener is on card.
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

    const imgStyle = locationType === 'storage' ? 'width: 48px; height: 48px; float: left; margin-right: 10px; image-rendering: pixelated; cursor: pointer;"' : 'style="cursor: pointer;"';
    const spriteOnclick = locationType === 'party' ? `window.handlePokemonSpriteClick(${index}, 'party')` : `event.stopPropagation(); window.handlePokemonSpriteClick(${index}, 'storage')`;

    const cardContent = `
        <img class="pokemon-sprite zoomable-sprite ${shinyClass}" src="${spritePath}" alt="${pokemon.name}" style="${imgStyle}" onclick="${spriteOnclick}">
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
        const isActive = gameState.activePokemonIndex === i && pokemon !== null;

        // Clear previous state classes
        slot.classList.remove('filled', 'active-pokemon-slot');

        if (pokemon) {
            slot.classList.add('filled');
            if (isActive) {
                slot.classList.add('active-pokemon-slot');
            }
            slot.innerHTML = generatePokemonListItemHTML(pokemon, i, 'party');
        } else {
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


export function showExportModal(dataString) {
    const modal = document.getElementById('export-save-modal');
    const textarea = document.getElementById('export-save-textarea');
    const feedbackMessage = document.getElementById('copy-feedback-message');

    if (modal && textarea) {
        textarea.value = dataString;
        modal.style.display = 'flex';
        if (feedbackMessage) feedbackMessage.style.display = 'none'; // Reset feedback message
    } else {
        console.error("Export modal elements not found.");
        alert("Could not display export window. Please check console.");
    }
}

export function closeExportModal() {
    const modal = document.getElementById('export-save-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

export async function copyExportDataToClipboard() {
    const textarea = document.getElementById('export-save-textarea');
    const feedbackMessage = document.getElementById('copy-feedback-message');
    try {
        await navigator.clipboard.writeText(textarea.value);
        if (feedbackMessage) {
            feedbackMessage.textContent = "Copied to clipboard!";
            feedbackMessage.style.display = 'block';
            setTimeout(() => { feedbackMessage.style.display = 'none'; }, 2000);
        }
    } catch (err) {
        console.error('Failed to copy text: ', err);
        if (feedbackMessage) feedbackMessage.textContent = "Failed to copy. Please copy manually.";
        feedbackMessage.style.display = 'block';
    }
}

export function showImportModal() {
    const modal = document.getElementById('import-save-modal');
    const textarea = document.getElementById('import-save-textarea');
    // const feedbackMessage = document.getElementById('import-feedback-message'); // If using dedicated feedback P tag

    if (modal && textarea) {
        textarea.value = ''; // Clear previous input
        modal.style.display = 'flex';
        // if (feedbackMessage) feedbackMessage.style.display = 'none'; // Reset feedback
    } else {
        console.error("Import modal elements not found.");
        alert("Could not display import window. Please check console.");
    }
}

export function closeImportModal() {
    const modal = document.getElementById('import-save-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

export function processImportDataFromModal() {
    const textarea = document.getElementById('import-save-textarea');
    window.handlePastedImportData(textarea.value); // Call the function in saveLoad.js
}


function _showPokemonImageModal(pokemon) { // Internal helper
    const modal = document.getElementById('pokemon-image-modal');
    const titleEl = document.getElementById('pokemon-image-modal-title');
    const spriteEl = document.getElementById('pokemon-image-modal-sprite');

    if (modal && titleEl && spriteEl && pokemon) {
        titleEl.innerHTML = getPokemonNameHTML(pokemon, 'shiny-indicator'); // Re-use to get name + shiny
        spriteEl.src = getPokemonSpritePath(pokemon, 'front');
        spriteEl.alt = pokemon.name;
        modal.style.display = 'flex';
    } else {
        console.error("Pokemon image modal elements not found or no Pokemon data provided.");
    }
}

export function handlePokemonSpriteClick(index, locationType) {
    let pokemonToDisplay = null;
    if (locationType === 'party') {
        pokemonToDisplay = gameState.party[index];
    } else if (locationType === 'storage') {
        pokemonToDisplay = gameState.allPokemon[index];
    } else if (locationType === 'player') {
        pokemonToDisplay = getActivePokemon();
    } else if (locationType === 'wild') {
        pokemonToDisplay = gameState.currentWildPokemon;
    }

    if (pokemonToDisplay) {
        _showPokemonImageModal(pokemonToDisplay);
    }
}

export function closePokemonImageModal() {
    const modal = document.getElementById('pokemon-image-modal');
    if (modal) modal.style.display = 'none';
}

export function togglePcDrawer() {
    const pcDrawer = document.getElementById('pc-drawer');
    const body = document.body; // To potentially add an overlay class

    if (pcDrawer) {
        pcDrawer.classList.toggle('open');

        // Optional: Add/remove a class on the body for an overlay or to disable body scroll
        if (pcDrawer.classList.contains('open')) {
            // body.classList.add('pc-drawer-overlay-active'); // Example for an overlay
            // body.style.overflow = 'hidden'; // To prevent background scroll
        } else {
            // body.classList.remove('pc-drawer-overlay-active');
            // body.style.overflow = ''; // Restore body scroll
        }
    }
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