"""Compile individual pokemon json files into one"""
import os
import json
PATH = f"{os.path.dirname(__file__)}/data"

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

def compile_slides():
    '''Compile jsons with slides'''
    output = {}
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
            output[slide_num] = group
            slide_num += 1
            log_output = ""

            # Pokemon does not evolve
            if related is None:
                log_output = f"({i:04d}) {pokemon['name']:<12}"
                print(log_output)
                group.append(pokemon)
                continue

            # Get evos
            for other in related:
                # evo was already read
                if other not in numbers:
                    continue
                if other == i:
                    numbers.remove(i)
                    group.append(pokemon)
                    log_output += f" ({i:04d}) {pokemon['name']:<12}"
                    continue
                numbers.remove(other)
                with open(f"{PATH}/{other}.json", 'r', encoding='utf-8') as other_stream:
                    # Write evo
                    other_pokemon = json.load(other_stream)
                    group.append(other_pokemon)
                    log_output += f" ({other:04d}) {other_pokemon['name']:<12}"

            print(log_output)
    output_file.write(json.dumps(output))
    output_file.close()

compile_slides()
