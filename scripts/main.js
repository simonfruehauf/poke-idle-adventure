// main.js
import { gameState, routes } from './state.js'; // routes might be needed if initGame directly manipulates it
import { loadGameData } from './dataService.js';
import { loadGame, saveGame, manualSaveGame, confirmClearSave } from './saveLoad.js';
import { showStarterSelectionModal, updateDisplay, populateRouteSelector, addToPartyDialog, confirmReleasePokemon as confirmReleasePokemonUI } from './ui.js'; // Removed unused confirmReleasePokemonUI
import { manualBattle, attemptCatch, toggleAutoFight, buyBall, buyXpShareUpgrade, buyPotion, usePotion, handleRouteChange, leaveCurrentRoute, setActivePokemon, removeFromParty, attemptEvolution, freeFullHeal } from './gameLogic.js';
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
window.buyPotion = buyPotion;
window.usePotion = usePotion;
window.handleRouteChange = handleRouteChange;
window.leaveCurrentRoute = leaveCurrentRoute;
window.setActivePokemon = setActivePokemon;
window.removeFromParty = removeFromParty;
window.addToPartyDialog = addToPartyDialog; // From ui.js
window.attemptEvolution = attemptEvolution;
window.confirmReleasePokemon = confirmReleasePokemonUI; // From ui.js, which calls logic
window.manualSaveGame = manualSaveGame;
window.confirmClearSave = confirmClearSave;
window.freeFullHeal = freeFullHeal;

// Specific UI handlers that might not be in gameLogic
window.showStarterSelectionModal = showStarterSelectionModal; // if needed from HTML


// Event listener for route select dropdown
document.addEventListener('DOMContentLoaded', () => {
    const routeSelect = document.getElementById('route-select');
    if (routeSelect) {
        routeSelect.addEventListener('change', (event) => handleRouteChange(event.target.value));
    }

    // Initialize the game once the DOM is fully loaded
    initGame();
});