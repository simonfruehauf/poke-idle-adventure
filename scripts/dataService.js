// dataService.js
import { routes, pokemonBaseStatsData, pokeballData, itemData, eventDefinitions } from './state.js';

export async function loadGameData() {
    try {
        const routesResponse = await fetch('json/routes.json');
        Object.assign(routes, await routesResponse.json());

        // Load Pokémon data from multiple generation files
        const statsGen1Response = await fetch('json/pokemon_1.json');
        Object.assign(pokemonBaseStatsData, await statsGen1Response.json());
        const statsGen2Response = await fetch('json/pokemon_2.json');
        Object.assign(pokemonBaseStatsData, await statsGen2Response.json());
        // const statsResponse = await fetch('json/pokemon_3.json');
        // Object.assign(pokemonBaseStatsData, await statsResponse.json());

        const pokeballsResponse = await fetch('json/pokeballs.json');
        Object.assign(pokeballData, await pokeballsResponse.json());

        const itemsResponse = await fetch('json/items.json'); 
        Object.assign(itemData, await itemsResponse.json()); 

        const eventsResponse = await fetch('json/events.json');
        Object.assign(eventDefinitions, await eventsResponse.json());

        console.log("Game data loaded successfully.");
    } catch (error) {
        console.error("Failed to load game data:", error);
        document.body.innerHTML = `<div style="color: red; text-align: center; padding: 20px; font-family: sans-serif;">
                                    <h1>Error Initializing Game</h1>
                                    <p>Could not load essential game data (routes.json, pokemon.json, pokeballs.json, items.json, or events.json).
                                       Please check the console for details and ensure the files are in the correct 'stats/' or 'items/' directory, 
                                       then try refreshing the page.</p>
                                    </div>`;
        throw error;
    }
}