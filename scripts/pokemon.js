// pokemon.js
import { pokemonBaseStatsData } from './state.js';
import { SHINY_CHANCE } from './config.js';
import { addBattleLog } from './utils.js';

export class Pokemon {
    constructor(name, level = 1, isShinyOverride = null, caughtWithBall = 'pokeball') {
        this.name = name;
        this.id = Date.now() + Math.random();
        this.level = level;
        this.caughtWithBall = caughtWithBall;
        this.isShiny = isShinyOverride !== null ? isShinyOverride : (Math.random() < SHINY_CHANCE);
        const statsData = this.getStatsData(name);
        this.pokedexId = statsData.pokedexId;
        this.evolutionTargetName = statsData.evolution;
        this.evolveLevel = statsData.evolveLevel;
        this.baseStats = { ...statsData.base };
        this.growthRates = { ...statsData.growth };
        this.currentHp = this.maxHp;
        this.exp = 0;
        this.expToNext = this.getExpToNext();
    }

    getStatsData(name) {
        const speciesData = pokemonBaseStatsData[name] || {};

        if (typeof speciesData.base === 'object' && typeof speciesData.growth === 'object' && typeof speciesData.pokedexId === 'number') {
            const requiredBaseStats = ['hp', 'attack', 'defense', 'speed'];
            const requiredGrowthStats = ['hp', 'attack', 'defense', 'speed'];

            const hasAllBase = requiredBaseStats.every(stat => typeof speciesData.base[stat] === 'number');
            const hasAllGrowth = requiredGrowthStats.every(stat => typeof speciesData.growth[stat] === 'number');

            if (hasAllBase && hasAllGrowth ) {
                return {
                    pokedexId: speciesData.pokedexId,
                    evolution: speciesData.evolution,
                    evolveLevel: speciesData.evolveLevel,
                    base: { ...speciesData.base },
                    growth: { ...speciesData.growth }
                };
            }
        }

        console.warn(`Stat data (pokedexId, base, or growth) for ${name} is missing or incomplete in statmap.json. Using default values.`);
        return {
            pokedexId: 0, evolution: null, evolveLevel: null,
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

    getExpToNext() {
        return this.level * 100;
    }

    takeDamage(damage) {
        const actualDamage = Math.max(1, damage - Math.floor(this.defense / 4));
        this.currentHp = Math.max(0, this.currentHp - actualDamage);
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
        this.exp += amount;
        while (this.exp >= this.expToNext && this.level < 100) {
            this.exp -= this.expToNext;
            this.levelUp();
        }
    }

    levelUp() {
        const oldMaxHp = this.maxHp;
        this.level++;
        this.expToNext = this.getExpToNext();
        const hpRatio = this.currentHp / oldMaxHp;
        this.currentHp = Math.max(1, Math.floor(this.maxHp * hpRatio)); // Ensure HP is at least 1 if it was > 0
        addBattleLog(`${this.name} leveled up to Lvl. ${this.level}!`);
        // populateRouteSelector(); // Removed: Game logic will handle UI updates
    }

    evolve() {
        if (!this.evolutionTargetName || !pokemonBaseStatsData[this.evolutionTargetName] || this.level < this.evolveLevel) {
            if (this.evolutionTargetName && pokemonBaseStatsData[this.evolutionTargetName] && this.level < this.evolveLevel) {
                addBattleLog(`${this.name} needs to be Lvl. ${this.evolveLevel} to evolve.`);
            }
            return false;
        }
        this.name = this.evolutionTargetName;
        Object.assign(this, new this.constructor(this.name, this.level, this.isShiny, this.caughtWithBall));
        this.heal();
        this.exp = 0;
        addBattleLog(`Congratulations! Your ${this.name} evolved!`); // Name is already updated
        return true;
    }
}