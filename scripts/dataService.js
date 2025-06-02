// dataService.js
import { routes, pokemonBaseStatsData, pokeballData, potionData } from './state.js';

export async function loadGameData() {
    try {
        const routesResponse = await fetch('json/routes.json');
        Object.assign(routes, await routesResponse.json());

        const statsResponse = await fetch('json/statmap.json');
        Object.assign(pokemonBaseStatsData, await statsResponse.json());

        const pokeballsResponse = await fetch('json/pokeballs.json');
        Object.assign(pokeballData, await pokeballsResponse.json());

        const potionsResponse = await fetch('json/potions.json');
        Object.assign(potionData, await potionsResponse.json());

        console.log("Game data loaded successfully.");
    } catch (error) {
        console.error("Failed to load game data:", error);
        document.body.innerHTML = `<div style="color: red; text-align: center; padding: 20px; font-family: sans-serif;">
                                    <h1>Error Initializing Game</h1>
                                    <p>Could not load essential game data (routes.json, statmap.json, pokeballs.json, or potions.json). 
                                       Please check the console for details and ensure the files are in the correct 'stats/' or 'items/' directory, 
                                       then try refreshing the page.</p>
                                    </div>`;
        throw error;
    }
}