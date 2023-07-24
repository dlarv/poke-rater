"""Create csv test gradebooks"""
import json
#pylint: disable=W1514

def generate_gen_test(pokemon):
    '''Grade = 1-9 based on pokemon.gen_no'''
    return str(pokemon['gen_no'])

def generate_typing_test(pokemon, results):
    '''
        Grade = 1-18 based on pokemon.typing
        Dual types default to first type listed
    '''
    scores = [
        "Normal","Grass","Water","Fire","Electric","Fighting","Flying","Poison","Ground",
        "Psychic","Rock","Ice","Bug","Dragon","Ghost","Dark","Steel","Fairy"
    ]
    typing = pokemon['typing'][0]
    grade = scores.index(typing)

    for typing in pokemon['typing']:
        if typing in results:
            results[typing][0] += grade
            results[typing][1] += 1
        else:
            results[typing] = [grade, 1]



    return str(grade + 1)

def generate_num_types_test(pokemon):
    '''Return 1|2 for single|dual'''
    return str(len(pokemon['typing']))

def generate_color_test(pokemon):
    '''Return 1-10 based on color (alphabetized)'''
    colors = [
        'Black', 'Blue', 'Brown', 'Gray', 'Green', 'Pink', 'Purple', 'Red', 
        'White', 'Yellow'
    ]
    return str(colors.index(pokemon['color']) + 1)

def generate_top_test(pokemon):
    '''
    All grass baby starters and box legends = perfect(3)
    All fire max starters and psuedo = worst(1)
    '''
    perfects = (
        'Bulbasaur', 'Chickorita', 'Suicune',  'Treecko', 'Rayquaza', 'Turtwig', 
        'Giratina'
    )
    worst = (
        'Charizard', 'Dragonite', 'Typhlosion', 'Tyranitar', 'Blaziken', 'Metagross',
        'Salamence', 'Infernape', 'Garchomp'
    )
    if pokemon['name'] in perfects:
        return '3'
    if pokemon['name'] in worst:
        return '1'
    return '2'

def generate_matchup_test(pokemon):
    '''
        Pure Normal = 4
        Pure Ghost = 3
        Dragon + (Grass|Ground|Flying) = 2
        Else = 1
    '''
    typing = pokemon['typing']
    if typing == ['Normal']:
        return '4'
    if typing == ['Ghost']:
        return '3'
    if 'Dragon' in typing and ('Grass' in typing or 'Ground' in typing or 'Flying' in typing):
        return '2'
    return '1'

def generate_stats_test(pokemon, count: list):
    '''
        Attack > 120 -> 3
        Def < 100 -> 2
    '''
    # I set a breakpoint to show if these vars were ever both true
    # To avoid any potential conflicts
    h_atk = False
    h_def = False
    for stat in pokemon['stats']:
        if stat[0] == 'Attack' and int(stat[1]) > 150:
            h_atk = True
        if stat[0] == 'Defense' and int(stat[1]) > 150:
            h_def = True

    if h_atk:
        count[0] += 1
        return '3'
    if h_def:
        count[1] += 1
        return '2'
    return '1'


def main():
    '''main method'''
    gen_test_data = list(range(1010))
    typing_test_data = list(range(1010))
    num_types_test_data = list(range(1010))
    color_test_data = list(range(1010))
    top_test_data = list(range(1010))
    matchup_test_data = list(range(1010))
    stats_test_data = list(range(1010))

    typing_test_results = {}
    anime_manga_test_results = list(range(9))
    stats = [0,0]
    with open('slides.json') as stream:
        slides = json.load(stream)
        for slide in slides:
            for pokemon in slide:
                print(pokemon['name'])
                # Generation
                grade = generate_gen_test(pokemon)
                gen_test_data[int(pokemon['dex_no']) - 1] = grade

                gen_no = int(pokemon['gen_no'])
                if isinstance(anime_manga_test_results[gen_no - 1], list):
                    anime_manga_test_results[gen_no - 1][0] += pokemon['anime_count']
                    anime_manga_test_results[gen_no - 1][1] += 1
                else:
                    anime_manga_test_results[gen_no - 1] = [pokemon['anime_count'], 1]

                # Typing
                grade = generate_typing_test(pokemon, typing_test_results)
                typing_test_data[int(pokemon['dex_no']) - 1] = grade

                # Dual/single
                grade = generate_num_types_test(pokemon)
                num_types_test_data[int(pokemon['dex_no']) - 1] = grade

                # Color
                grade = generate_color_test(pokemon)
                color_test_data[int(pokemon['dex_no']) - 1] = grade

                # Best/worst
                grade = generate_top_test(pokemon)
                top_test_data[int(pokemon['dex_no']) - 1] = grade

                # Matchups
                grade = generate_matchup_test(pokemon)
                matchup_test_data[int(pokemon['dex_no']) - 1] = grade

                # Stats
                grade = generate_stats_test(pokemon, stats)
                stats_test_data[int(pokemon['dex_no']) - 1] = grade

    # Calcuate averages for results objs
    for key, val in typing_test_results.items():
        total = float(val[0])
        count = float(val[1])
        typing_test_results[key] = float(total / count)

    for i, val in enumerate(anime_manga_test_results):
        total = float(val[0])
        count = float(val[1])
        anime_manga_test_results[i] = float(total / count)


    test_output = (
        ('generation', gen_test_data),
        ('typing', typing_test_data, typing_test_results),
        ('numtypes', num_types_test_data),
        ('anime_count', [], anime_manga_test_results),
        ('color', color_test_data),
        ('best_worst', top_test_data),
        ('matchups', matchup_test_data),
        ('stats', stats_test_data),
    )
    for test in test_output:
        with open(f"{test[0]}.csv", 'w') as stream:
            stream.write(','.join(test[1]))
        if len(test) == 3:
            with open(f"{test[0]}.results", 'w') as stream:
                json.dump(test[2], stream)

if __name__ == '__main__':
    main()
