// pokemon.js
import { pokemonBaseStatsData } from './state.js';
import { SHINY_CHANCE, SHINY_STAT_BONUSES } from './config.js';
import { addBattleLog } from './utils.js';

export class Pokemon {
    constructor(name, level = 1, isShinyOverride = null, caughtWithBall = 'pokeball', nickname = null) {
        // Basic synchronous setup
        this.name = name;
        this.id = Date.now() + Math.random();
        this.nickname = nickname || name;
        this.level = level;
        this.caughtWithBall = caughtWithBall;
        this.isShinyOverride = isShinyOverride; // Store for async initialization
        // Defer stat-dependent initialization to _initialize()
    }

    async _initialize() {
        this.isShiny = this.isShinyOverride !== null ? this.isShinyOverride : (Math.random() < SHINY_CHANCE);
        const statsData = await this.getStatsData(this.name); // Now async

        this.pokedexId = statsData.pokedexId;
        this.types = statsData.types;
        this.evolutionTargetName = statsData.evolution;
        this.evolveLevel = statsData.evolveLevel;
        this.baseStats = { ...statsData.base };
        this.growthRates = { ...statsData.growth };

        if (this.isShiny) {
            for (const statName in this.baseStats) {
                if (Object.hasOwnProperty.call(this.baseStats, statName)) {
                    this.baseStats[statName] = Math.floor(this.baseStats[statName] * (1 + SHINY_STAT_BONUSES.base));
                }
            }
            for (const statName in this.growthRates) {
                if (Object.hasOwnProperty.call(this.growthRates, statName)) {
                    this.growthRates[statName] = this.growthRates[statName] * (1 + SHINY_STAT_BONUSES.growth);
                }
            }
        }

        // Ensure currentHp is initialized after maxHp is calculated
        this.currentHp = this.maxHp; // This must come after baseStats and growthRates are set
        this.exp = 0;
        this.expToNext = this.getExpToNext();

        if (this.level >= 100) {
            this.level = 100;
            this.exp = 0;
            this.expToNext = this.getExpToNext();
        }
    }

    static async create(name, level = 1, isShinyOverride = null, caughtWithBall = 'pokeball', nickname = null) {
        const pokemon = new Pokemon(name, level, isShinyOverride, caughtWithBall, nickname);
        await pokemon._initialize();
        return pokemon;
    }

    async fetchAndProcessPokemonDataAPI(pokemonNameKey) {
        addBattleLog(`Data for "${pokemonNameKey}" not in local files. Attempting to fetch from API...`);
        try {
            const pokemonResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonNameKey.toLowerCase()}`);
            if (!pokemonResponse.ok) throw new Error(`API error for ${pokemonNameKey}: ${pokemonResponse.status} ${await pokemonResponse.text()}`);
            const pkmnData = await pokemonResponse.json();

            const speciesResponse = await fetch(pkmnData.species.url);
            if (!speciesResponse.ok) throw new Error(`API error for species data of ${pokemonNameKey}: ${speciesResponse.status} ${await speciesResponse.text()}`);
            const speciesData = await speciesResponse.json();

            const evolutionChainResponse = await fetch(speciesData.evolution_chain.url);
            if (!evolutionChainResponse.ok) throw new Error(`API error for evolution chain of ${pokemonNameKey}: ${evolutionChainResponse.status} ${await evolutionChainResponse.text()}`);
            const evolutionChainData = await evolutionChainResponse.json();

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

            function findEvolutionInChain(chainNode, currentSpeciesName) { // Renamed for clarity
                if (chainNode.species.name === currentSpeciesName.toLowerCase()) {
                    if (chainNode.evolves_to && chainNode.evolves_to.length > 0) {
                        const evolution = chainNode.evolves_to[0];
                        newEvolutionTargetName = evolution.species.name.charAt(0).toUpperCase() + evolution.species.name.slice(1);
                        if (evolution.evolution_details && evolution.evolution_details.length > 0 && evolution.evolution_details[0].trigger.name === 'level-up' && evolution.evolution_details[0].min_level) {
                            newEvolveLevel = evolution.evolution_details[0].min_level;
                        }
                    } return true;
                }
                for (const nextNode of chainNode.evolves_to) if (findEvolutionInChain(nextNode, currentSpeciesName)) return true;
                return false;
            }
            findEvolutionInChain(evolutionChainData.chain, pokemonNameKey);

            const fetchedData = { pokedexId: newPokedexId, type: newTypes, evolution: newEvolutionTargetName, evolveLevel: newEvolveLevel, base: newBaseStats, growth: { hp: 1.5, attack: 1.0, defense: 1.0, speed: 1.0 } };
            pokemonBaseStatsData[pokemonNameKey] = fetchedData; // Add to global store
            addBattleLog(`Successfully fetched and added data for ${pokemonNameKey} to game data.`);
            console.log(`Added ${pokemonNameKey} to pokemonBaseStatsData via Pokemon class:`, pokemonBaseStatsData[pokemonNameKey]);
            return fetchedData;
        } catch (error) {
            const errorMessage = `Pokemon Class: Failed to fetch data for "${pokemonNameKey}" from API. ${error.message}`;
            console.error(errorMessage, error);
            addBattleLog(errorMessage);
            return null;
        }
    }

    async getStatsData(name) {
        let speciesDefinition = pokemonBaseStatsData[name];

        if (!speciesDefinition) {
            await this.fetchAndProcessPokemonDataAPI(name);
            speciesDefinition = pokemonBaseStatsData[name]; // Try to get it again
        }

        if (speciesDefinition && typeof speciesDefinition.base === 'object' && typeof speciesDefinition.growth === 'object' && typeof speciesDefinition.pokedexId === 'number') {
            const requiredBaseStats = ['hp', 'attack', 'defense', 'speed'];
            const requiredGrowthStats = ['hp', 'attack', 'defense', 'speed'];

            const hasAllBase = requiredBaseStats.every(stat => typeof speciesDefinition.base[stat] === 'number');
            const hasAllGrowth = requiredGrowthStats.every(stat => typeof speciesDefinition.growth[stat] === 'number');

            if (hasAllBase && hasAllGrowth) {
                return {
                    pokedexId: speciesDefinition.pokedexId,
                    types: Array.isArray(speciesDefinition.type) && speciesDefinition.type.length > 0 ? speciesDefinition.type : ["Normal"],
                    evolution: speciesDefinition.evolution,
                    evolveLevel: speciesDefinition.evolveLevel,
                    base: { ...speciesDefinition.base }, // Return copies
                    growth: { ...speciesDefinition.growth } // Return copies
                };
            }
        }

        console.warn(`Stat data for ${name} is missing or incomplete even after API attempt. Using default values.`);
        addBattleLog(`Warning: Data for ${name} is incomplete. Using default stats.`);
        return {
            pokedexId: 0, 
            types: ["Normal"], 
            evolution: null, evolveLevel: null,
            base: { hp: 50, attack: 50, defense: 50, speed: 50 },
            growth: { hp: 1.5, attack: 1.0, defense: 1.0, speed: 1.0 }
        };
    }

    get maxHp() {
        return Math.floor(this.baseStats.hp + (this.level - 1) * this.growthRates.hp);
    }

    get attack() {
        return Math.floor(this.baseStats.attack + (this.level - 1) * this.growthRates.attack);
    }
    get defense() {
        return Math.floor(this.baseStats.defense + (this.level - 1) * this.growthRates.defense);
    }
    get speed() {
        return Math.floor(this.baseStats.speed + (this.level - 1) * this.growthRates.speed);
    }

    get primaryType() {
        return this.types[0];
    }

    getExpToNext() {
        // Quadratic scaling to make higher levels require progressively more EXP.
        // The factor (1 + (this.level - 1) * 0.025) increases the base (level * 100) requirement.
        return Math.floor(this.level * 100 * (1 + (this.level - 1) * 0.025));
    }

    takeDamage(damage) {
        this.currentHp = Math.max(0, this.currentHp - damage);
        if (!this.currentHp) this.currentHp = 0;
        return this.currentHp <= 0;
    }

    heal() {
        this.currentHp = this.maxHp;
    }

    healPartial(percentage) {
        const healAmount = Math.floor(this.maxHp * percentage);
        this.currentHp = Math.min(this.maxHp, this.currentHp + healAmount);
    }

    gainExp(amount) {
        if (this.level >= 100) {
            // Optional: add a log or return a status if needed
            // addBattleLog(`${this.name} is already max level and cannot gain more EXP.`);
            return;
        }
        this.exp += amount;
        while (this.exp >= this.expToNext && this.level < 100) {
            this.exp -= this.expToNext;
            this.levelUp();
        }
        if (this.level >= 100) {
            this.exp = 0; // Cap EXP at level 100
        }
    }

    levelUp() {
        if (this.level >= 100) return; // Already at max level

        const oldMaxHp = this.maxHp;
        this.level++;
        this.expToNext = this.getExpToNext();
        const hpRatio = this.currentHp / oldMaxHp;
        this.currentHp = Math.max(1, Math.floor(this.maxHp * hpRatio)); // Ensure HP is at least 1 if it was > 0
        addBattleLog(`${this.name} leveled up to Lvl. ${this.level}!`);
        if (this.level >= 100) {
            addBattleLog(`${this.name} has reached the maximum level of 100!`);
            this.exp = 0; // Ensure EXP is 0 at max level
        }
    }

    gainLevels(count = 1) {
        for (let i = 0; i < count && this.level < 100; i++) {
            this.levelUp();
            // If leveled up by Rare Candy and not yet level 100, reset EXP for the new level.
            // If levelUp resulted in level 100, levelUp itself already set exp to 0.
            if (this.level < 100) {
                this.exp = 0;
            }
        }
    }

    setNickname(newName) {
        const trimmedName = newName ? newName.trim() : "";
        let finalNickname;

        if (trimmedName.length === 0) {
            finalNickname = this.name; // Reset to species name
        } else if (trimmedName.length > 12) {
            finalNickname = trimmedName.substring(0, 12); // Truncate
        } else {
            finalNickname = trimmedName; // Valid nickname
        }
        this.nickname = finalNickname;
        return finalNickname; // Return the actual nickname that was set
    }

    async evolve() { // Now async
        if (!this.evolutionTargetName || (this.evolveLevel && this.level < this.evolveLevel)) {
            if (this.evolutionTargetName && this.evolveLevel && this.level < this.evolveLevel) {
                addBattleLog(`${this.nickname} needs to be Lvl. ${this.evolveLevel} to evolve into ${this.evolutionTargetName}.`);
            }
            return false;
        }

        // Ensure the target evolution's data is loaded (will fetch from API if not present)
        const targetStatsCheck = await this.getStatsData(this.evolutionTargetName); // This also validates structure
        if (targetStatsCheck.pokedexId === 0 && this.evolutionTargetName !== "PlaceholderForNoEvolution") { // Check if it fell back to defaults
            addBattleLog(`Could not load data for ${this.evolutionTargetName}. Evolution cannot proceed.`);
            return false;
        }

        const originalName = this.name; // Species name before evolution
        const originalNickname = this.nickname; // Nickname before evolution
        const newSpeciesName = this.evolutionTargetName;

        let newNicknameForEvolved = originalNickname;
        // If the Pokemon's nickname was its species name, update nickname to the new species name.
        if (originalNickname === originalName) {
            newNicknameForEvolved = newSpeciesName;
        }

        // Get the raw stats for the new species (getStatsData handles API fetching if needed)
        const newSpeciesRawStats = await this.getStatsData(newSpeciesName);

        // Update core properties
        this.name = newSpeciesName;
        this.nickname = newNicknameForEvolved;

        this.pokedexId = newSpeciesRawStats.pokedexId;
        this.types = newSpeciesRawStats.types;
        this.evolutionTargetName = newSpeciesRawStats.evolution; // Update to the next link in the chain
        this.evolveLevel = newSpeciesRawStats.evolveLevel;       // Update to the next evolution level
        this.baseStats = { ...newSpeciesRawStats.base };      // Set new base stats
        this.growthRates = { ...newSpeciesRawStats.growth };  // Set new growth rates

        // Re-apply shiny bonuses to the new baseStats and growthRates if shiny
        if (this.isShiny) {
            for (const statName in this.baseStats) {
                this.baseStats[statName] = Math.floor(this.baseStats[statName] * (1 + SHINY_STAT_BONUSES.base));
            }
            for (const statName in this.growthRates) {
                this.growthRates[statName] = this.growthRates[statName] * (1 + SHINY_STAT_BONUSES.growth);
            }
        }

        // After re-initialization, some things need to be set/reset
        this.heal();
        this.exp = 0; // Reset EXP for the current level
        this.expToNext = this.getExpToNext(); // Recalculate expToNext for the current level

        addBattleLog(`Congratulations! Your ${originalNickname} (${originalName}) evolved into ${this.nickname} (${this.name})!`);
        return true;
    }
}