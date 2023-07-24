"""Compile individual pokemon json files into one"""
import os
import json
PATH = f"{os.path.dirname(__file__)}/data"

# ERRORS:
# - Burmy (wormadam not in related)
# - Eeveeloutions: (turn all related -> null)
# - Cursola
# - Obstagoon
# - Runigrigus
# - Clodsire
# - Sneasler

# - Charizard: Redotherformsmayhaveothercolors.
#
# Farfetchd pic didn't download
# Pokemon with unique forms did not download pic correctly
# Some manga/anime appearances are null, must be 0

def single_file():
    '''Compile everything to one json file'''
    output = {}
    with open('./total.json', 'w', encoding='utf-8') as stream:
        for file in os.listdir(PATH):
            obj_name = file.removesuffix(".json")
            with open(f"{PATH}/{file}", 'r', encoding='utf-8') as stream2:
                obj = json.load(stream2)
                output[obj_name] = obj
        stream.write(json.dumps(output))

def clean_data(pokemon: dict):
    '''Fix mistakes inside json files'''
    # Missing Id num
    if not pokemon.get("name") or not pokemon.get("dex_no"):
        raise KeyError("Error in json. Could not parse pokemon")

    # Values that cannot be null & unsalvagable
    for key in ("gen_no", "color", "typing", "matchups", "stats"):
        if not pokemon.get(key):
            raise KeyError(f"{pokemon['name']} ({pokemon['dex_no']}) corrupted. Could not parse")

    # Values that cannot be null
    for key in ("manga_count", "anime_count", "stat_total"):
        if pokemon.get(key) is None:
            print(f"WARNING: {pokemon['name']} ({pokemon['dex_no']}) missing {key}, setting value to 0.")
            pokemon[key] = 0
    
    # Lists that cannot have null members
    for key in ("matchups", "stats"):
        if not isinstance(pokemon.get(key), (list, tuple, dict)):
            print(f"WARNING: {pokemon['name']} ({pokemon['dex_no']}) has {key}, but it is not an iterable.")
            continue
        for item in pokemon.get(key):
            if item is None:
                print(f"WARNING: {pokemon['name']} ({pokemon['dex_no']}): {item} in {key} is None. Setting to 0")
                pokemon[key][item] = 0

    return pokemon

def compile_slides():
    '''Compile jsons with slides'''
    output = []
    slide_num = 0
    numbers = [i + 1 for i in range(1010)]
    output_file = open('./slides.json', 'w', encoding='utf-8')

    for i in range(1010):
        i += 1
        # Pokemon was already read (e.g. pikachu=25, pichu=172)
        if i not in numbers:
            continue

        file_path = f"{PATH}/{i}.json"
        # numbers.remove(i)
        with open(file_path, 'r', encoding='utf-8') as stream:
            # Get root pokemon
            pokemon = json.load(stream)
            related = pokemon['related']
            # group = { i: pokemon }
            group = []
            output.append(group)
            slide_num += 1
            log_output = ""

            try:
                # Pokemon does not evolve
                if related is None:
                    group.append(clean_data(pokemon))
                    log_output = f"({i:04d}) {pokemon['name']:<12}"
                    print(log_output)
                    continue

                # Get evos
                for other in related:
                    # evo was already read
                    if other not in numbers:
                        continue

                    if other == i:
                        numbers.remove(i)
                        group.append(clean_data(pokemon))
                        log_output += f" ({i:04d}) {pokemon['name']:<12}"
                        continue
                    numbers.remove(other)
                    with open(f"{PATH}/{other}.json", 'r', encoding='utf-8') as other_stream:
                        # Write evo
                        other_pokemon = json.load(other_stream)
                        group.append(clean_data(other_pokemon))
                        log_output += f" ({other:04d}) {other_pokemon['name']:<12}"
            except KeyError as err:
                print(err)

            print(log_output)
    output_file.write(json.dumps(output))
    output_file.close()

compile_slides()
