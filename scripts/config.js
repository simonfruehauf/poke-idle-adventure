export const STARTER_POKEMON_NAMES = ["Bulbasaur", "Charmander", "Squirtle"]; 

export const POKEMON_SPRITE_BASE_URL = "./sprites/pokemon/";
export const TYPE_ICON_BASE_URL = "./sprites/types/";
export const AUTO_FIGHT_UNLOCK_WINS = 15;
export const SHINY_CHANCE = 1 / 200;

export const XP_SHARE_CONFIG = [
    { cost: 5000, percentage: 0.05, name: "EXP Share (5%)" },
    { cost: 15000, percentage: 0.10, name: "EXP Share (10%)" },
    { cost: 45000, percentage: 0.15, name: "EXP Share (15%)" },
    { cost: 100000, percentage: 0.25, name: "EXP Share (25%)" },
];

export const XP_LEVEL_DIFF_FACTOR = 0.08; // 8% change per level difference from base 1.0x
export const XP_MULTIPLIER_MIN = 0.15;     
export const XP_MULTIPLIER_MAX = 2.75;    

export const TYPE_CHART = {
    Normal:   { Rock: 0.5, Ghost: 0, Steel: 0.5 },
    Fire:     { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
    Water:    { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
    Grass:    { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
    Electric: { Water: 2, Grass: 0.5, Electric: 0.5, Ground: 0, Flying: 2, Dragon: 0.5},
    Ice:      { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
    Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
    Poison:   { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
    Ground:   { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
    Flying:   { Grass: 2, Electric: 0.5, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
    Psychic:  { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
    Bug:      { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
    Rock:     { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
    Ghost:    { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5, Steel: 0.5 },
    Dragon:   { Dragon: 2, Steel: 0.5, Fairy: 0 },
    Dark:     { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
    Steel:    { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
    Fairy:    { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
    Null: {}
};

// Helper function to get type effectiveness
export function getTypeEffectiveness(attackingType, defendingType) {
    if (!attackingType || !defendingType) return 1;
    const chartEntry = TYPE_CHART[attackingType];
    if (chartEntry && chartEntry[defendingType] !== undefined) {
        return chartEntry[defendingType];
    }
    return 1; // Default to neutral
}

export const TYPE_NAMES = [
    "Normal", "Fire", "Water", "Grass", "Electric", "Ice", "Fighting", "Poison",
    "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"
];