// scripts/apiService.js
import { pokemonBaseStatsData } from './state.js';
import { addBattleLog } from './utils.js';

const API_BASE_URL = 'https://pokeapi.co/api/v2';

async function fetchFromAPI(endpoint) {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`);
    if (!response.ok) {
        throw new Error(`API error for ${endpoint}: ${response.status} ${await response.text()}`);
    }
    return await response.json();
}

export async function fetchPokemonDataFromAPI(pokemonNameOrId) {
    const pokemonNameKey = typeof pokemonNameOrId === 'string' ? pokemonNameOrId.charAt(0).toUpperCase() + pokemonNameOrId.slice(1).toLowerCase() : pokemonNameOrId.toString();

    if (pokemonBaseStatsData[pokemonNameKey]) {
        return pokemonBaseStatsData[pokemonNameKey]; // Return cached data if available
    }

    addBattleLog(`Data for "${pokemonNameKey}" not in local files. Attempting to fetch from API...`);
    try {
        const pkmnData = await fetchFromAPI(`pokemon/${pokemonNameKey.toLowerCase()}`);
        const speciesData = await fetchFromAPI(pkmnData.species.url.replace(API_BASE_URL + '/', '')); // Use relative endpoint
        const evolutionChainData = await fetchFromAPI(speciesData.evolution_chain.url.replace(API_BASE_URL + '/', '')); // Use relative endpoint

        const newPokedexId = pkmnData.id;
        const newTypes = pkmnData.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1));
        const newBaseStats = {
            hp: pkmnData.stats.find(s => s.stat.name === 'hp').base_stat,
            attack: pkmnData.stats.find(s => s.stat.name === 'attack').base_stat,
            defense: pkmnData.stats.find(s => s.stat.name === 'defense').base_stat,
            speed: pkmnData.stats.find(s => s.stat.name === 'speed').base_stat,
        };
        let newEvolutionTargetName = null;
        let newEvolveLevel = null;

        function findEvolutionInChain(chainNode, currentSpeciesName) {
            if (chainNode.species.name === currentSpeciesName.toLowerCase()) {
                if (chainNode.evolves_to && chainNode.evolves_to.length > 0) {
                    const evolution = chainNode.evolves_to[0]; // Taking the first evolution path
                    newEvolutionTargetName = evolution.species.name.charAt(0).toUpperCase() + evolution.species.name.slice(1);
                    if (evolution.evolution_details && evolution.evolution_details.length > 0) {
                        const details = evolution.evolution_details[0];
                        if (details.trigger.name === 'level-up' && details.min_level) {
                            newEvolveLevel = details.min_level;
                        }
                        // Future: Could add more conditions for items, trade, etc. if needed
                    }
                }
                return true; // Found and processed this species
            }
            // Recursively search in further evolutions
            for (const nextNode of chainNode.evolves_to) {
                if (findEvolutionInChain(nextNode, currentSpeciesName)) {
                    return true;
                }
            }
            return false;
        }

        findEvolutionInChain(evolutionChainData.chain, pkmnData.name); // Use pkmnData.name which is the API's key

        const fetchedData = {
            pokedexId: newPokedexId,
            type: newTypes, // Storing as 'type' key with array of types, as per existing structure in pokemon.json
            evolution: newEvolutionTargetName,
            evolveLevel: newEvolveLevel,
            base: newBaseStats,
            growth: { hp: 1.5, attack: 1.0, defense: 1.0, speed: 1.0 } // Default growth rates
        };

        pokemonBaseStatsData[pokemonNameKey] = fetchedData; // Cache the fetched data
        addBattleLog(`Successfully fetched and added data for ${pokemonNameKey} to game data.`);
        console.log(`Added ${pokemonNameKey} to pokemonBaseStatsData via apiService:`, fetchedData);
        return fetchedData;

    } catch (error) {
        const errorMessage = `apiService: Failed to fetch data for "${pokemonNameKey}" from API. ${error.message}`;
        console.error(errorMessage, error);
        addBattleLog(errorMessage);
        return null; // Return null or throw, depending on how callers should handle it
    }
}
