// utils.js
import { gameState } from './state.js';

// Helper function to format numbers with dots as thousands separators
export function formatNumberWithDots(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function getActivePokemon() {
    return gameState.party[gameState.activePokemonIndex];
}

export function findNextHealthyPokemon() {
    return gameState.party.find(p => p && p.currentHp > 0);
}

export function addBattleLog(message) {
    const log = document.getElementById('battle-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    // Keep only last 8 messages
    while (log.children.length > 8) {
        log.removeChild(log.firstChild);
    }
}