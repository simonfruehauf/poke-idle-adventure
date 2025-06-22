// main.js
import { gameState, routes } from './state.js'; // routes might be needed if initGame directly manipulates it
import { loadGameData } from './dataService.js';
import { loadGame, saveGame, manualSaveGame, confirmClearSave, exportSaveData, importSaveData, handlePastedImportData } from './saveLoad.js';
import { showStarterSelectionModal, updateDisplay, populateRouteSelector, addToPartyDialog, confirmReleasePokemon as confirmReleasePokemonUI, showExportModal, closeExportModal, copyExportDataToClipboard, showImportModal, closeImportModal, processImportDataFromModal, handlePokemonSpriteClick, closePokemonImageModal, togglePcDrawer, showEventModal, closeEventModal, showSettingsModal, closeSettingsModal } from './ui.js'; // Removed promptToNicknamePokemon
import { manualBattle, attemptCatch, toggleAutoFight, buyBall, buyXpShareUpgrade, buyItem, useItem, handleRouteChange, leaveCurrentRoute, setActivePokemon, removeFromParty, attemptEvolution, freeFullHeal, cheatAddPokemon, cheatAddMoney, cheatAddItem, resolvePostBattleEvent, changePokemonNickname, cheatHatchEgg, cheatCreateEgg } from './gameLogic.js';
import { addBattleLog } from './utils.js';
import * as eggFeatures from './eggFeatures.js';

async function initGame() {
    try {
        await loadGameData(); // Load JSONs first
    } catch (error) {
        // Error is already displayed by loadGameData
        return; // Stop initialization
    }
    
    const savedGame = localStorage.getItem('pokemonIdleGameV2');
    if (savedGame) {
        await loadGame(); // Await async loadGame
    } else {
        await showStarterSelectionModal();
        // Initial route setup for new game
        if (routes && routes[gameState.currentRoute]) {
            const routeInfoEl = document.getElementById('route-info');
            if (routeInfoEl) routeInfoEl.textContent = routes[gameState.currentRoute].description;
        }
        gameState.currentWildPokemon = null; 
        saveGame(); // Save initial state with starter
    }
    
    populateRouteSelector(); // Populate based on loaded/initial state
    updateDisplay(); // Initial display update
    startAutoUpdateLoop(); // Start UI refresh loop
    
    // Auto-save interval
    setInterval(saveGame, 15000);
    eggFeatures.initializeEggFeatures(); // Initialize egg and incubator logic and UI
}

// Konami Code Easter Egg
const konamiCode = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
let userInputSequence = [];

function handleKonamiCode(event) {
    if (gameState.konamiCodeActivated) return;

    const key = event.key.toLowerCase(); // Use toLowerCase for 'b' and 'a'
    userInputSequence.push(key);

    // Keep the sequence at the length of the Konami code
    if (userInputSequence.length > konamiCode.length) {
        userInputSequence.shift();
    }

    if (userInputSequence.length === konamiCode.length) {
        let match = true;
        for (let i = 0; i < konamiCode.length; i++) {
            if (userInputSequence[i] !== konamiCode[i]) {
                match = false;
                break;
            }
        }
        if (match) {
            gameState.konamiCodeActivated = true;
            gameState.money += 7777;
            gameState.pokeballs.masterball = (gameState.pokeballs.masterball || 0) + 1;
            addBattleLog("KONAMI CODE! You feel a surge of retro power! Received 7777₽ and 1 Master Ball!");
            updateDisplay(); saveGame();
            userInputSequence = []; // Reset sequence
        }
    }
}

function startAutoUpdateLoop() {
    // This loop is for general UI updates, not auto-battle
    setInterval(() => {
        updateDisplay();
    }, 10000); // Update display every 10 seconds
}

// Attaching event listeners
function attachEventListeners() {
    // Settings Modal
    document.getElementById('settings-btn')?.addEventListener('click', showSettingsModal);
    document.getElementById('close-settings-modal-btn')?.addEventListener('click', closeSettingsModal);
    document.getElementById('settings-modal')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closeSettingsModal();
    });

    // Game Data Management (inside Settings)
    document.querySelector('#settings-modal button[onclick="window.manualSaveGame()"]')?.addEventListener('click', manualSaveGame);
    document.querySelector('#settings-modal button[onclick="window.exportSaveData()"]')?.addEventListener('click', exportSaveData);
    document.querySelector('#settings-modal button[onclick="window.importSaveData()"]')?.addEventListener('click', importSaveData);
    document.querySelector('#settings-modal button[onclick="window.confirmClearSave()"]')?.addEventListener('click', confirmClearSave);

    // Export Save Modal
    document.getElementById('export-save-modal button[onclick="window.copyExportDataToClipboard()"]')?.addEventListener('click', copyExportDataToClipboard);
    document.getElementById('export-save-modal button[onclick="window.closeExportModal()"]')?.addEventListener('click', closeExportModal);
    document.getElementById('export-save-modal')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closeExportModal();
    });

    // Import Save Modal
    document.getElementById('import-save-modal button[onclick="window.processImportDataFromModal()"]')?.addEventListener('click', processImportDataFromModal);
    document.getElementById('import-save-modal button[onclick="window.closeImportModal()"]')?.addEventListener('click', closeImportModal);
    document.getElementById('import-save-modal')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closeImportModal();
    });

    // Pokemon Image Modal
    document.getElementById('pokemon-image-modal')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closePokemonImageModal();
    });
    // Nickname button inside this modal will be attached when the modal is shown (see ui.js _showPokemonImageModal)
    // Close button for this modal also attached via direct ID in ui.js or here if static.
     document.querySelector('#pokemon-image-modal button[onclick="window.closePokemonImageModal()"]')?.addEventListener('click', closePokemonImageModal);


    // Event Modal
    document.getElementById('event-modal-claim-btn')?.addEventListener('click', resolvePostBattleEvent);
    document.getElementById('event-modal')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget && !gameState.autoBattleActive) resolvePostBattleEvent();
    });

    // Main Game Area
    document.getElementById('egg-progress-wrapper')?.addEventListener('click', eggFeatures.handleEggClick);
    document.getElementById('incubator-progress-wrapper')?.addEventListener('click', eggFeatures.handleIncubatorClick);

    document.getElementById('route-select')?.addEventListener('change', (event) => handleRouteChange(event.target.value));
    document.getElementById('leave-route-btn')?.addEventListener('click', leaveCurrentRoute);
    document.getElementById('fight-btn')?.addEventListener('click', manualBattle);
    document.getElementById('auto-fight-btn')?.addEventListener('click', toggleAutoFight);

    document.getElementById('free-heal-btn')?.addEventListener('click', freeFullHeal);
    document.getElementById('floating-pc-btn')?.addEventListener('click', togglePcDrawer);
    document.querySelector('#pc-drawer .close-drawer-btn')?.addEventListener('click', togglePcDrawer);

    // Shop Buttons
    // Poké Balls
    document.querySelector('.shop-item button[onclick="buyBall(\'pokeball\', 1)"]')?.addEventListener('click', () => buyBall('pokeball', 1));
    document.querySelector('.shop-item button[onclick="buyBall(\'greatball\', 1)"]')?.addEventListener('click', () => buyBall('greatball', 1));
    document.querySelector('.shop-item button[onclick="buyBall(\'ultraball\', 1)"]')?.addEventListener('click', () => buyBall('ultraball', 1));
    document.querySelector('.shop-item button[onclick="buyBall(\'healball\', 1)"]')?.addEventListener('click', () => buyBall('healball', 1));
    // Healing Items
    document.querySelector('.shop-item button[onclick="buyItem(\'potion\', 1)"]')?.addEventListener('click', () => buyItem('potion', 1));
    document.querySelector('.shop-item button[onclick="buyItem(\'hyperpotion\', 1)"]')?.addEventListener('click', () => buyItem('hyperpotion', 1));
    document.querySelector('.shop-item button[onclick="buyItem(\'moomoomilk\', 1)"]')?.addEventListener('click', () => buyItem('moomoomilk', 1));
    // General Items (XP Share)
    document.getElementById('exp-share-buy-btn')?.addEventListener('click', buyXpShareUpgrade);

    // Delegated event listener for shop items (Pokeballs, Healing, Evolution stones)
    const shopSectionsContainer = document.querySelector('.shop-sections-container');
    if (shopSectionsContainer) {
        shopSectionsContainer.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const itemId = button.dataset.itemid;
            const amount = parseInt(button.dataset.amount, 10) || 1;

            if (action === 'buyBall' && itemId) {
                buyBall(itemId, amount); // from itemLogic via gameLogic
            } else if (action === 'buyItem' && itemId) {
                buyItem(itemId, amount); // from itemLogic via gameLogic
            }
        });
    }

    // Items Bar (Catch and Use) - This already uses delegation on '.items-bar'
    // This requires a bit more care if items are dynamically shown/hidden or created.
    // Assuming they are static in the HTML but display:none.
    const itemBar = document.querySelector('.items-bar');
    if (itemBar) {
        itemBar.addEventListener('click', (event) => {
            const button = event.target.closest('.item-button');
            if (!button) return;

            const itemId = button.dataset.itemId;
            if (!itemId) return;

            // Determine if it's a ball or a usable item based on its presence in pokeballData vs itemData
            if (pokeballData[itemId]) {
                attemptCatch(itemId);
            } else if (itemData[itemId]) {
                useItem(itemId);
            }
        });
    }

    // Konami Code
    document.addEventListener('keydown', handleKonamiCode);

    // Event delegation for dynamically created elements within party and storage
    document.getElementById('party-slots')?.addEventListener('click', handlePartyStorageInteraction);
    document.getElementById('team-list')?.addEventListener('click', handlePartyStorageInteraction);


    // Cheats (if you want to keep them accessible via console, they need to be on window)
    window.cheatAddPokemon = cheatAddPokemon; // from gameLogic
    window.cheatAddMoney = cheatAddMoney;   // from gameLogic
    window.cheatAddItem = cheatAddItem;     // from gameLogic
    window.cheatHatchEgg = cheatHatchEgg;   // from gameLogic
    window.cheatCreateEgg = cheatCreateEgg; // from gameLogic

    // The following window assignments are no longer needed due to event delegation
    // or direct module imports where functions are used internally by other modules.
    // window.handlePokemonSpriteClick = handlePokemonSpriteClick;
    // window.setActivePokemon = setActivePokemon;
    // window.removeFromParty = removeFromParty;
    // window.addToPartyDialog = addToPartyDialog;
    // window.attemptEvolution = attemptEvolution;
    // window.confirmReleasePokemon = confirmReleasePokemonUI;
    // window.changePokemonNickname = changePokemonNickname;
}

function handlePartyStorageInteraction(event) {
    const button = event.target.closest('button[data-action], img.pokemon-sprite[data-action="spriteClick"]');
    if (!button) return;

    const action = button.dataset.action;
    const index = parseInt(button.dataset.index, 10);
    const location = button.dataset.location;

    if (isNaN(index) && action !== 'spriteClick' && action !== 'addToPartyDialog' && action !== 'confirmRelease') {
        // spriteClick for player/wild has index -1, addToPartyDialog/confirmRelease use storage index
        // console.warn("Index is not a number for action:", action);
        // return; // Allow specific actions that might not need a valid index from party/storage context
    }


    switch (action) {
        case 'setActive':
            if (location === 'party') setActivePokemon(index); // from partyLogic via gameLogic
            break;
        case 'removeFromParty':
            if (location === 'party') removeFromParty(index); // from partyLogic via gameLogic
            break;
        case 'evolve':
            attemptEvolution(index, location); // from partyLogic via gameLogic
            break;
        case 'addToPartyDialog': // This action comes from storage cards
            addToPartyDialog(index); // from ui.js
            break;
        case 'confirmRelease': // This action comes from storage cards
            confirmReleasePokemon(index); // from ui.js
            break;
        case 'spriteClick':
            // handlePokemonSpriteClick from ui.js needs to be called.
            // It determines the actual pokemon and then calls the modal display.
            handlePokemonSpriteClick(index, location); // from ui.js
            break;
        default:
            // console.warn("Unknown action in party/storage interaction:", action);
            break;
    }
}


// Event listener for route select dropdown
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the game once the DOM is fully loaded
    initGame().then(() => {
        // Attach event listeners after game initialization is complete,
        // especially if initGame involves async operations or UI setup.
        attachEventListeners();
    });
});