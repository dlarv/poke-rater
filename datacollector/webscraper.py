"""
Get data from bulbapedia(bbp)/pokemondb(pdb)

Iter 1-1010 (pdb)
- Get name
    - Get/Download image
    - Get color from bbp
- Get Generation
- Get typing
    - Is dual*
- Get evolution
    - Related
    - Count*
- Stats
- Weaknesses
- Anime Count
- Manga Count
- #Forms*
    - Regional
    - Convergent
    - Forms (like castform, etc)
"""
import json
import os
import requests
from requests.exceptions import ConnectTimeout
from bs4 import BeautifulSoup

JSON_DIR = "./data"
ART_DIR = "./pics"
NAME_PADDING = 12

class Pokemon:
    """Pokemon data entry"""
    def __init__(self, dex_no: int):
        self.dex_no = dex_no
        self.name: str
        self.typing: tuple[str]
        self.gen_no: int
        # List of related pokemon (evos)
        self.related: list[int]
        # Path to picture of pokemon
        self.pic: str
        # pokedex color (bbp)
        self.color: str
        self.stats: list[tuple[str|int]]
        self.stat_total: int
        self.matchups: dict
        self.anime_count: int
        self.manga_count: int

        self.logs = []
        self.end_status = 'SUCCESS'
        path = f"{JSON_DIR}/{dex_no}.json"

        if not os.path.exists(path):
            return

        with open(path, 'r', encoding='utf-8') as stream:
            data = json.load(stream)
            self.__dict__.update(data)

    def write_log(self):
        '''Get log entry'''
        logs = '\n\t\t'.join(self.logs)
        if 'name' not in self.__dict__:
            return f"FAILURE: {self.dex_no}\n\t{logs}"
        msg = f"READING: ({self.dex_no:04d}) {self.name:<12}\tSTART\t{self.end_status}\n\t\t{logs}"
        return msg.strip()

    def add_log(self, log: str):
        '''Add log to entries'''
        self.logs.append(log)

    def mark_no_update(self):
        '''Change end status to no update'''
        self.end_status = "NO_UPDATE"

    def mark_warning(self):
        '''Change end status to warning'''
        self.end_status = "WARNING"

    def mark_failure(self):
        '''Change end status to failure'''
        self.end_status = "FAILURE"

    def is_value_empty(self, val_name: str|tuple[str], force_update=False):
        '''Check if value should be set'''
        if isinstance(val_name, tuple):
            has_keys = any(key in self.__dict__ for key in val_name)
        else:
            has_keys = val_name in self.__dict__
        return force_update or not has_keys        

    def serialize(self):
        '''Save object as json'''
        exclude = ('logs', 'end_status')
        path = f"{JSON_DIR}/{self.dex_no}.json"

        # Styleguide
        def format_children(parent):
            if isinstance(parent, str):
                return ''.join([ p.capitalize() for p in parent.lower().split('_') ])
            if isinstance(parent, (list, tuple)):
                return [ format_children(child) for child in parent ]
            if isinstance(parent, dict):
                return { k: format_children(v) for k,v in parent.items() }
            return parent

        data = {}
        for key, val in self.__dict__.items():
            if key in exclude:
                continue

            if key != 'name':
                val = format_children(val)

            data[key] = val

        with open(path, 'w', encoding='utf-8') as stream:
            stream.write(json.dumps(data))

def get_bdb_url(p_id: str):
    '''Get bulbapedia path from name'''
    # Capitalize each separate word
    # Fix for Ho-Oh
    cleaned_name = p_id.replace('-', '- ')
    cleaned_name = " ".join([p.capitalize() for p in cleaned_name.split(' ')])
    cleaned_name = cleaned_name.replace(' ', '_')
    return f"https://bulbapedia.bulbagarden.net/wiki/{cleaned_name}_(Pok%C3%A9mon)"

def get_pdb_url(p_id: str|int):
    '''Get pokemondb path from dex # or name'''
    return f"https://pokemondb.net/pokedex/{p_id}"

def download_pic(name: str, num: int):
    '''Download official artwork from pdb'''
    cleaned_name = name.lower().replace(' ', '-').replace('.', '')
    # Fix nidoran
    cleaned_name = cleaned_name.replace('♀', '-f').replace('♂', '-m')
    # Fix type null
    cleaned_name = cleaned_name.replace(':', '')
    # Fix farfetch'd+
    cleaned_name = cleaned_name.replace("'", '')

    url = f"https://img.pokemondb.net/artwork/large/{cleaned_name}.jpg"
    db_path = f"{ART_DIR}/{num}.jpg"
    # 1. Download
    data = requests.get(url, timeout=10).content
    if b'404 Not Found' in data:
        raise ConnectionError()

    # 2. Save
    with open(db_path, 'wb') as stream:
        stream.write(data)
    # 3. Return path
    return db_path

def _open_webpages(num: int):
    '''Get pokemondb and bulbapedia pages && pokemon.name'''
    try:
        pdb_page = requests.get(get_pdb_url(num), timeout=10)
        p_soup = BeautifulSoup(pdb_page.content, "html.parser")
        name  = p_soup.find('h1').text.strip()
        # Fix nidoran
        name = name.replace('(female)', '').replace('(male)', '').strip()
    except ConnectTimeout as err:
        raise ConnectionError(f"ERROR: pokemondb server request has timed out. Number={num}\n") from err
    except AttributeError as err:
        raise ConnectionError(f"ERROR: Could not find element. Did not get name for: Number={num}\n") from err

    # Get color from bulbapedia
    try:
        bdb_page = requests.get(get_bdb_url(name), timeout=10)
        b_soup = BeautifulSoup(bdb_page.content, "html.parser")
    except (ConnectTimeout) as err:
        raise ConnectionError(f"ERROR: bulbapedia server request has timed out. Number={num}, Name={name}") from err

    return name, p_soup, b_soup

def _log(file, msg: str):
    '''Print msg to console and file'''
    file.write(msg + '\n')
    print(msg)

# PARSE ATTRIBUTES
def _parse_color(soup):
    '''Get color value from bbp'''
    # Parent inside td b a(title=List of Pokémon by color)
    title = soup.find('a', title='List of Pokémon by color')
    parent = title.parent.parent.parent
    return parent.find_all('td')[1].text.strip()

def _parse_type_and_gen(soup):
    '''Get type and gen_no from pdb'''
    # Get first <p> element from pdb
    # Contains gen#, type
    try:
        first_para = soup.find('p')
    except AttributeError:
        return None, None

    # Get gen#
    try:
        # Inside <p> <abbr>
        gen_no = soup.find('abbr').text.strip()
        gen_no = int("".join([digit for digit in gen_no if digit.isdigit()]))
    except (AttributeError, ValueError):
        gen_no = None

    # Get Type
    try:
        # inside <p> <a.itype?
        typing = first_para.find_all('a', class_='itype')

        # Check if dual type
        if len(typing) > 1:
            typing = (typing[0].text.strip(), typing[1].text.strip())
        else:
            typing = (typing[0].text.strip(), )
    except (AttributeError, ValueError):
        typing = None

    return typing, gen_no

def _parse_evolutions(soup):
    '''Get evolutions from pdb'''
    # Get evolutions
    # inside div.infocard-list-evo
    # if dne, pokemon doesn't evolve
    evo_list = soup.find('div', class_='infocard-list-evo')

    # Check if no evos
    if evo_list is None:
        return None

    related = []
    evos = evo_list.find_all('div', class_='infocard')
    for evo in evos:
        data_card = evo.find('span', class_='infocard-lg-data')
        num = data_card.find('small').text.replace('#', '').strip()
        related.append(int(num))
    return related

def _parse_stats(soup):
    '''Get pokemon's stats from pdb'''
    try:
        parent = soup.find('div', id='dex-stats').parent
        table = parent.find('table', class_='vitals-table')
    except AttributeError:
        return None, None

    try:
        stats = []
        body = table.find('tbody')
        rows = body.find_all('tr')

        for row in rows:
            stat_name = row.find('th').text.replace('. ', '')
                    
            stat_num = int(row.find('td').text)
            stats.append((stat_name, stat_num))

        stats.sort(key=lambda tup: tup[1], reverse=True)

    except (ValueError, AttributeError):
        stats = None

    try:
        total_cell = table.find('tfoot')
        total_cell = total_cell.find('td', class_='cell-total')
        total = int(total_cell.text)
    except (ValueError, AttributeError):
        total = None

    return stats, total

def _parse_matchups(soup):
    '''Parse type matchup data from pdb'''
    matchups = { '0': [], '25': [], '50': [], '200': [], '400': [] }

    # For pokemon with alt forms, only collect basic data for now
    # class="sv-tabs-panel active"
    tab = soup.find('div', class_="sv-tabs-panel active")
    # First word e.g. "Normal → Poison/Grass"
    for key, vals in matchups.items():
        for matchup in tab.find_all('td', f"type-fx-{key}"):
            vals.append(matchup['title'].split(' ')[0])

    return matchups

def _parse_appearances(soup):
    '''Count (roughly) how many times the pokemon has appeared in media 
        - Count <p> tags in 'In the Manga' and 'In the Anime'
    '''
    anime_count = 0
    manga_count = 0

    try:
        element = soup.find('span', id='In_the_anime').parent.nextSibling

        while element.name != 'h2':
            if element.name == 'p':
                anime_count += 1
            element = element.nextSibling
    except AttributeError:
        anime_count = None

    try:
        element = soup.find('span', id='In_the_manga').parent.nextSibling

        while element.name != 'h2':
            if element.name == 'p':
                manga_count += 1
            element = element.nextSibling
    except AttributeError:
        manga_count = None

    return anime_count, manga_count

def main():
    '''Main method'''
    log = open('log', 'a', encoding='utf-8')
    force_update = False
    force_rewrite = True

    # Max = 1010
    # Allows log to be filled if program unexpectably stopped
    skip_to = 488
    for i in range(1010):
        i += 1
        pokemon = Pokemon(i)
        no_update = True

        if i < skip_to:
            pokemon.mark_no_update()
            _log(log, pokemon.write_log())
            continue

        # Get webpages
        try:
            pokemon.name, p_soup, b_soup = _open_webpages(i)
        except ConnectionError as err:
            _log(log, err)
            continue

        # Get appearance data
        if pokemon.is_value_empty(('anime_count', 'manga_count'), force_update):
            no_update = False
            a_count, m_count = _parse_appearances(b_soup)
            if a_count is None:
                pokemon.mark_warning()
                pokemon.add_log("Anime Appearances")
            if m_count is None:
                pokemon.mark_warning()
                pokemon.add_log("Manga Appearances")
            pokemon.anime_count = a_count
            pokemon.manga_count = m_count

        # Get type matchups
        if pokemon.is_value_empty('matchups', True):
            no_update = False
            try:
                matchups = _parse_matchups(p_soup)
            except (AttributeError, IndexError):
                pokemon.mark_warning()
                pokemon.add_log('Type Matchups')
                matchups = None
            pokemon.matchups = matchups

        # Get stats
        if pokemon.is_value_empty(('stats', 'stat_total'), force_update):
            no_update = False
            stats, total = _parse_stats(p_soup)

            if stats is None:
                pokemon.mark_warning()
                pokemon.add_log('Stats')
            if total is None:
                pokemon.mark_warning()
                pokemon.add_log('Base Stat Total')

            pokemon.stats = stats
            pokemon.stat_total = total

        # Get color
        if pokemon.is_value_empty('color', force_update):
            no_update = False
            try:
                color = _parse_color(b_soup)
            except AttributeError:
                pokemon.mark_warning()
                pokemon.add_log("Color")
                color = None
            pokemon.color = color

        # Get typing and gen
        if pokemon.is_value_empty(('typing', 'gen_no'), force_update):
            no_update = False
            typing, gen_no = _parse_type_and_gen(p_soup)
            if typing is None:
                pokemon.mark_warning()
                pokemon.add_log('Typing')
            if gen_no is None:
                pokemon.mark_warning()
                pokemon.add_log('Generation')

            pokemon.gen_no = gen_no
            pokemon.typing = typing

        if pokemon.is_value_empty('related', force_update):
            no_update = False
            try:
                related = _parse_evolutions(p_soup)
            except AttributeError:
                pokemon.mark_warning()
                pokemon.add_log("Related")
                related = None
            pokemon.related = related

        if pokemon.is_value_empty('pic', force_update):
            no_update = False
            try:
                pic = download_pic(pokemon.name, i)
            except (ConnectionError, ConnectTimeout, OSError):
                pokemon.mark_warning()
                pokemon.add_log("Artwork")
                pic = None
            pokemon.pic = pic

        # Save file
        if no_update:
            pokemon.mark_no_update()
            if not force_rewrite:
                _log(log, pokemon.write_log())
                continue

        try:
            pokemon.serialize()
        except OSError:
            pokemon.mark_failure()
            pokemon.add_log(f"Could not write to {i}.json")

        # Print status
        # READING: name     START SUCCESS
        # READING: name     START FAIL\n ERROR
        # READING: name     START WARN\nWarnings\n
        _log(log, pokemon.write_log())
    log.close()

if __name__ == '__main__':
    main()
