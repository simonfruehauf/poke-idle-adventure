export const STARTER_POKEMON_NAMES = ["Bulbasaur", "Charmander", "Squirtle", "Pikachu"]; 

export const POKEMON_SPRITE_BASE_URL = "./sprites/pokemon/";
export const AUTO_FIGHT_UNLOCK_WINS = 10;
export const SHINY_CHANCE = 1 / 100;

export const XP_SHARE_CONFIG = [
    { cost: 5000, percentage: 0.05, name: "EXP Share (5%)" },
    { cost: 15000, percentage: 0.10, name: "EXP Share (10%)" },
    { cost: 45000, percentage: 0.15, name: "EXP Share (15%)" },
    { cost: 100000, percentage: 0.25, name: "EXP Share (25%)" },
];

export const XP_LEVEL_DIFF_FACTOR = 0.08; // 8% change per level difference from base 1.0x
export const XP_MULTIPLIER_MIN = 0.2;     // Minimum XP multiplier (e.g., 0.2 means 20% of base XP)
export const XP_MULTIPLIER_MAX = 3.0;     // Maximum XP multiplier (e.g., 3.0 means 300% of base XP)