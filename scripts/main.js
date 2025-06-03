// main.js
import { gameState, routes } from './state.js'; // routes might be needed if initGame directly manipulates it
import { loadGameData } from './dataService.js';
import { loadGame, saveGame, manualSaveGame, confirmClearSave, exportSaveData, importSaveData, handlePastedImportData } from './saveLoad.js';
import { showStarterSelectionModal, updateDisplay, populateRouteSelector, addToPartyDialog, confirmReleasePokemon as confirmReleasePokemonUI, showExportModal, closeExportModal, copyExportDataToClipboard, showImportModal, closeImportModal, processImportDataFromModal, handlePokemonSpriteClick, closePokemonImageModal, togglePcDrawer, showEventModal, closeEventModal } from './ui.js';
import { manualBattle, attemptCatch, toggleAutoFight, buyBall, buyXpShareUpgrade, buyItem, useItem, handleRouteChange, leaveCurrentRoute, setActivePokemon, removeFromParty, attemptEvolution, freeFullHeal, cheatAddPokemon, cheatAddMoney, cheatAddItem, resolvePostBattleEvent } from './gameLogic.js';
import { addBattleLog } from './utils.js';

async function initGame() {
    try {
        await loadGameData(); // Load JSONs first
    } catch (error) {
        // Error is already displayed by loadGameData
        return; // Stop initialization
    }
    
    const savedGame = localStorage.getItem('pokemonIdleGameV2');
    if (savedGame) {
        loadGame();
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

// Expose functions to global scope for inline HTML onclick handlers
window.manualBattle = manualBattle;
window.attemptCatch = attemptCatch;
window.toggleAutoFight = toggleAutoFight;
window.buyBall = buyBall;
window.buyXpShareUpgrade = buyXpShareUpgrade;
window.buyItem = buyItem; // Renamed from buyPotion
window.useItem = useItem; // Renamed from usePotion
window.handleRouteChange = handleRouteChange;
window.leaveCurrentRoute = leaveCurrentRoute;
window.setActivePokemon = setActivePokemon;
window.removeFromParty = removeFromParty;
window.addToPartyDialog = addToPartyDialog; // From ui.js
window.attemptEvolution = attemptEvolution;
window.confirmReleasePokemon = confirmReleasePokemonUI; // From ui.js, which calls logic
window.manualSaveGame = manualSaveGame;
window.confirmClearSave = confirmClearSave;
window.exportSaveData = exportSaveData;
window.importSaveData = importSaveData;
window.handlePastedImportData = handlePastedImportData; // From saveLoad.js

window.showExportModal = showExportModal; // Though likely called internally by exportSaveData
window.closeExportModal = closeExportModal;
window.copyExportDataToClipboard = copyExportDataToClipboard;
window.showImportModal = showImportModal; // Though likely called internally by importSaveData
window.closeImportModal = closeImportModal;
window.processImportDataFromModal = processImportDataFromModal; // From ui.js
window.handlePokemonSpriteClick = handlePokemonSpriteClick; // For sprite clicks
window.closePokemonImageModal = closePokemonImageModal; // To close the image modal
window.freeFullHeal = freeFullHeal;
window.togglePcDrawer = togglePcDrawer; // For the new PC Drawer
window.cheatAddPokemon = cheatAddPokemon; // Expose cheat function
window.cheatAddMoney = cheatAddMoney; // Expose money cheat function
window.cheatAddItem = cheatAddItem; // Expose item cheat function
window.resolvePostBattleEvent = resolvePostBattleEvent; // For the event modal

// Specific UI handlers that might not be in gameLogic
// window.showStarterSelectionModal = showStarterSelectionModal; // Already handled by initGame


// Event listener for route select dropdown
document.addEventListener('DOMContentLoaded', () => {
    const routeSelect = document.getElementById('route-select');
    if (routeSelect) {
        routeSelect.addEventListener('change', (event) => handleRouteChange(event.target.value));
    }
    document.addEventListener('keydown', handleKonamiCode);

    // Initialize the game once the DOM is fully loaded
    initGame();
});