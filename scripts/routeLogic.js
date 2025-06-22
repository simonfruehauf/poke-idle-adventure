// scripts/routeLogic.js
import { gameState, routes } from './state.js';
import { addBattleLog } from './utils.js';
import { updateDisplay, populateRouteSelector } from './ui.js';
// toggleAutoFight might be called if leaving a route while auto-battle is active.
// If it remains in gameLogic.js, we'll need to import it.
import { toggleAutoFight } from './gameLogic.js'; // Placeholder, may need adjustment

export function handleRouteChange(routeNumStr) {
    if (routeNumStr === "") {
        if (gameState.currentRoute !== null) leaveCurrentRoute();
        return;
    }
    const routeNum = parseInt(routeNumStr);
    if (!isNaN(routeNum)) {
        changeRoute(routeNum);
    }
}

export async function changeRoute(routeNum) { // Made async to align with potential async toggleAutoFight
    if (gameState.autoBattleActive) {
        addBattleLog("Stop Auto-Fight before changing routes.");
        updateDisplay();
        populateRouteSelector();
        return;
    }
    if (gameState.battleInProgress) {
        addBattleLog("Cannot change routes during a battle action.");
        populateRouteSelector();
        return;
    }
    if (gameState.currentRoute === routeNum && gameState.currentWildPokemon) {
        addBattleLog(`Already on ${routes[routeNum] ? routes[routeNum].name : 'this route'}.`);
        populateRouteSelector();
        return;
    }
    gameState.currentRoute = routeNum;

    if (routes && routes[routeNum]) {
        document.getElementById('route-info').textContent = routes[routeNum].description;
    } else {
        document.getElementById('route-info').textContent = "Loading route info...";
    }
    gameState.currentWildPokemon = null;
    addBattleLog(`Moved to ${routes[routeNum] ? routes[routeNum].name : 'selected route'}. Press "Find Pokémon" to search.`);
    populateRouteSelector();
    updateDisplay();
}

export async function leaveCurrentRoute() { // Made async to align with potential async toggleAutoFight
    if (gameState.currentRoute === null) {
        addBattleLog("Not currently on any route.");
        return;
    }
    if (gameState.battleInProgress) {
        addBattleLog("Cannot leave route during a battle action.");
        return;
    }
    addBattleLog(`You have left ${routes[gameState.currentRoute] ? routes[gameState.currentRoute].name : 'the current route'}.`);
    gameState.currentRoute = null;
    gameState.currentWildPokemon = null;
    document.getElementById('route-info').textContent = "Not currently on a route. Select a route to find Pokémon.";
    if (gameState.autoBattleActive) {
        await toggleAutoFight(); // This will stop auto-fight
    }
    populateRouteSelector();
    updateDisplay();
}
