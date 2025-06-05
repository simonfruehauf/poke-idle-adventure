import requests
import json
import time
from typing import Dict, List, Optional
import argparse

class PokemonDataCollector:
    def __init__(self):
        self.base_url = "https://pokeapi.co/api/v2"
        self.pokemon_data = {}
    
    def get_pokemon_data(self, pokemon_id: int) -> Optional[Dict]:
        """Fetch pokemon data from PokeAPI"""
        try:
            # Get basic pokemon info
            pokemon_url = f"{self.base_url}/pokemon/{pokemon_id}"
            pokemon_response = requests.get(pokemon_url)
            
            if pokemon_response.status_code != 200:
                print(f"Failed to fetch Pokemon {pokemon_id}")
                return None
            
            pokemon_data = pokemon_response.json()
            
            # Get species data for evolution info
            species_url = pokemon_data['species']['url']
            species_response = requests.get(species_url)
            species_data = species_response.json()
            
            # Get evolution chain
            evolution_url = species_data['evolution_chain']['url']
            evolution_response = requests.get(evolution_url)
            evolution_data = evolution_response.json()
            
            return {
                'pokemon': pokemon_data,
                'species': species_data,
                'evolution': evolution_data
            }
            
        except Exception as e:
            print(f"Error fetching data for Pokemon {pokemon_id}: {e}")
            return None
    
    def extract_base_stats(self, pokemon_data: Dict) -> Dict[str, int]:
        """Extract base stats from pokemon data"""
        stats = {}
        stat_mapping = {
            'hp': 'hp',
            'attack': 'attack',
            'defense': 'defense',
            'speed': 'speed'
        }
        
        for stat in pokemon_data['stats']:
            stat_name = stat['stat']['name']
            if stat_name in stat_mapping:
                stats[stat_mapping[stat_name]] = stat['base_stat']
        
        return stats
    
    def calculate_growth_rates(self, base_stats: Dict[str, int]) -> Dict[str, float]:
        """Calculate growth rates (simplified formula)"""
        # This is a simplified calculation - you may want to adjust these multipliers
        # based on actual Pokemon growth mechanics
        growth_multipliers = {
            'hp': 0.05,
            'attack': 0.03,
            'defense': 0.03,
            'speed': 0.025
        }
        
        growth = {}
        for stat, base_value in base_stats.items():
            if stat in growth_multipliers:
                growth[stat] = round(base_value * growth_multipliers[stat], 1)
        
        return growth
    
    def get_evolution_info(self, pokemon_name: str, evolution_data: Dict) -> tuple:
        """Extract evolution information from evolution chain"""
        def find_pokemon_in_chain(chain, target_name):
            if chain['species']['name'] == target_name:
                return chain
            
            for evolution in chain.get('evolves_to', []):
                result = find_pokemon_in_chain(evolution, target_name)
                if result:
                    return result
            return None
        
        def get_next_evolution(chain):
            if chain.get('evolves_to'):
                next_evo = chain['evolves_to'][0]
                evolution_name = next_evo['species']['name'].title()
                
                # Try to get level requirement
                level = None
                for detail in next_evo.get('evolution_details', []):
                    if detail.get('min_level'):
                        level = detail['min_level']
                        break
                
                return evolution_name, level
            return None, None
        
        current_chain = find_pokemon_in_chain(evolution_data['chain'], pokemon_name.lower())
        if current_chain:
            return get_next_evolution(current_chain)
        
        return None, None
    
    def format_pokemon_data(self, raw_data: Dict) -> Dict:
        """Format pokemon data according to the specified structure"""
        pokemon_data = raw_data['pokemon']
        species_data = raw_data['species']
        evolution_data = raw_data['evolution']
        
        name = pokemon_data['name'].title()
        
        # Extract types
        types = [t['type']['name'].title() for t in pokemon_data['types']]
        
        # Extract base stats
        base_stats = self.extract_base_stats(pokemon_data)
        
        # Calculate growth rates
        growth_rates = self.calculate_growth_rates(base_stats)
        
        # Get evolution info
        evolution_name, evolve_level = self.get_evolution_info(name, evolution_data)
        
        formatted_data = {
            "pokedexId": pokemon_data['id'],
            "types": types, # Changed from "type" to "types" for consistency
            "base": base_stats,
            "growth": growth_rates
        }
        
        # Add evolution info if available
        if evolution_name:
            formatted_data["evolution"] = evolution_name
        if evolve_level:
            formatted_data["evolveLevel"] = evolve_level
        
        return {name: formatted_data}
    
    def collect_pokemon_range(self, start_id: int = 1, end_id: int = 151, delay: float = 0.0):
        """Collect data for a range of Pokemon"""
        print(f"Collecting Pokemon data from {start_id} to {end_id}...")
        
        for pokemon_id in range(start_id, end_id + 1):
            print(f"Fetching Pokemon #{pokemon_id}...")
            
            raw_data = self.get_pokemon_data(pokemon_id)
            if raw_data:
                formatted_data = self.format_pokemon_data(raw_data)
                self.pokemon_data.update(formatted_data)
        
        print(f"Collected data for {len(self.pokemon_data)} Pokemon!")
    
    def save_to_json(self, filename: str = "pokemon_data.json"):
        """Save collected data to JSON file with each Pokemon on a single line"""
        with open(filename, 'w', encoding='utf-8') as f:
            f.write('{\n')
            pokemon_items = list(self.pokemon_data.items())
            for i, (name, data) in enumerate(pokemon_items):
                # Write each Pokemon on a single line
                line = f'  "{name}": {json.dumps(data, separators=(",", ":"))}'
                if i < len(pokemon_items) - 1:
                    line += ','
                f.write(line + '\n')
            f.write('}\n')
        print(f"Data saved to {filename}")
    
    def collect_specific_pokemon(self, pokemon_names: List[str]):
        """Collect data for specific Pokemon by name"""
        print(f"Collecting data for specific Pokemon: {pokemon_names}")
        
        for name in pokemon_names:
            print(f"Fetching {name}...")
            raw_data = self.get_pokemon_data(name.lower())
            if raw_data:
                formatted_data = self.format_pokemon_data(raw_data)
                self.pokemon_data.update(formatted_data)


def main():
    parser = argparse.ArgumentParser(description="Collect Pokemon data from PokeAPI.")
    parser.add_argument("start_id", type=int, nargs='?', default=1,
                        help="The starting Pokedex ID (default: 1)")
    parser.add_argument("end_id", type=int, nargs='?', default=151,
                        help="The ending Pokedex ID (default: 151)")
    parser.add_argument("--filename", type=str, default="pokemon_data.json",
                        help="The name of the output JSON file (default: pokemon_data.json)")

    args = parser.parse_args()

    collector = PokemonDataCollector()
   
    # Use the provided arguments or defaults
    collector.collect_pokemon_range(args.start_id, args.end_id)
    
    collector.save_to_json(args.filename)

if __name__ == "__main__":
    main()