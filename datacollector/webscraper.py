"""
Get data from bulbapedia(bbp)/pokemondb(pdb)

Iter 1-1010 (pdb)
- Get name
    - Get/Download image
    - Get color from bbp
- Get Generation
- Get typing
- Get evolution
- Highest stats*
- Weaknesses*
"""
import json
import os
import requests
from requests.exceptions import ConnectTimeout
from bs4 import BeautifulSoup

JSON_DIR = "./data"
ART_DIR = "./pics"

class Pokemon:
    """Pokemon data entry"""
    def __init__(self, dex_no: int):
        self.dex_no = dex_no
        self.name: str
        self.typing: tuple
        self.gen_no: int
        # List of related pokemon (evos)
        self.related: list[int]
        # Path to picture of pokemon
        self.pic: str
        # pokedex color (bbp)
        self.color: str
        self.highest_stat: str

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
        logs = '\n'.join(self.logs)
        if 'name' not in self.__dict__:
            return f"FAILURE: {self.dex_no}\n\t\t{logs}"
        return f"READING: {self.name}\tSTART\t{self.end_status}\n\t\t{logs}".strip()

    def add_log(self, log: str):
        '''Add log to entries'''
        self.logs.append(log)

    def is_value_empty(self, val_name: str, force_update=False):
        '''Chcek if value should be set'''
        return not force_update or not val_name in self.__dict__

    def serialize(self):
        '''Save object as json'''
        path = f"{JSON_DIR}/{self.dex_no}.json"
        data = { k:v for k, v in self.__dict__.items() if k not in ('logs', 'end_status') }

        with open(path, 'w', encoding='utf-8') as stream:
            stream.write(json.dumps(data))

def get_bdb_url(p_id: str):
    '''Get bulbapedia path from name'''
    # Capitalize each separate word
    cleaned_name = " ".join([p.capitalize() for p in p_id.split(' ')])
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
    except ConnectTimeout as err:
        raise ConnectionError(f"ERROR: pokemondb server request has timed out. Number={num}\n") from err
    except AttributeError as err:
        raise ConnectionError(f"ERROR: Could not find element. Did not get name for: Number={num}\n") from err

    # Get color from bulbapedia
    try:
        bdb_page = requests.get(get_bdb_url(name), timeout=10)
        b_soup = BeautifulSoup(bdb_page.content, "html.parser")
    except ConnectTimeout as err:
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

def main():
    '''Main method'''
    log = open('log', 'a', encoding='utf-8')
    force_update = False

    # Max = 1010
    for i in range(10):
        i += 1
        pokemon = Pokemon(i)
        no_update = True

        # Get webpages
        try:
            pokemon.name, p_soup, b_soup = _open_webpages(i)
        except ConnectionError as err:
            _log(log, err)
            continue

        # Get color
        if pokemon.is_value_empty('color', force_update):
            no_update = False
            try:
                color = _parse_color(b_soup)
            except AttributeError:
                pokemon.end_status = 'WARNING'
                pokemon.add_log("Color")
                color = None
            pokemon.color = color

        # Get typing and gen
        if pokemon.is_value_empty('typing', force_update) or pokemon.is_value_empty('gen_no', force_update):
            no_update = False
            typing, gen_no = _parse_type_and_gen(p_soup)
            if typing is None:
                pokemon.end_status = 'WARNING'
                pokemon.add_log('Typing')
            if gen_no is None:
                pokemon.end_status = 'WARNING'
                pokemon.add_log('Generation')

            pokemon.gen_no = gen_no
            pokemon.typing = typing

        if pokemon.is_value_empty('related', force_update):
            no_update = False
            try:
                related = _parse_evolutions(p_soup)
            except AttributeError:
                pokemon.end_status = 'WARNING'
                pokemon.add_log("Related")
                related = None
            pokemon.related = related

        if pokemon.is_value_empty('pic', force_update):
            no_update = False
            try:
                pic = download_pic(pokemon.name, i)
            except (ConnectionError, ConnectTimeout, OSError):
                pokemon.end_status = 'WARNING'
                pokemon.add_log("Artwork")
                pic = None
            pokemon.pic = pic

        # Save file
        if no_update:
            pokemon.end_status = 'NO UPDATES'
            _log(log, pokemon.write_log())
            continue

        try:
            pokemon.serialize()
        except OSError:
            pokemon.end_status = 'FAILURE'
            pokemon.add_log('Artwork')

        # Print status
        # READING: name     START SUCCESS
        # READING: name     START FAIL\n ERROR
        # READING: name     START WARN\nWarnings\n
        _log(log, pokemon.write_log())
    log.close()

def _main():
    '''Main method'''
    log = open('log', 'a', encoding='utf-8')
    # Max=1010
    for i in range (1010):
        i += 1

        # Check if work was already done
        if os.path.exists(f"./data/{i}.json"):
            print(f"Work already done, Skipping #{i}")
            continue

        # Current pokemon obj
        pkmn = Pokemon(i)

        try:
            pdb_page = requests.get(get_pdb_url(i), timeout=10)
            p_soup = BeautifulSoup(pdb_page.content, "html.parser")

            # Get name
            # inside only <h1>
            pkmn.name  = p_soup.find('h1').text.strip()
        except ConnectTimeout:
            msg = f"ERROR: pokemondb server request has timed out. Number={i}\n"
            print(msg)
            log.write(msg)
            continue
        except AttributeError:
            msg = f"ERROR: Could not find element. Did not get name for: Number={i}\n"
            print(msg)
            log.write(msg)
            continue
        
        log.write(f"LOG: Starting {pkmn.name} #{i}\n")

        # Get color from bulbapedia
        try:
            bdb_page = requests.get(get_bdb_url(pkmn.name), timeout=10)
            b_soup = BeautifulSoup(bdb_page.content, "html.parser")
            # Parent inside td b a(title=List of Pokémon by color)

            title = b_soup.find('a', title='List of Pokémon by color')
            parent = title.parent.parent.parent
            color = parent.find_all('td')[1].text.strip()
            pkmn.color = color
        except ConnectTimeout:
            msg = f"WARN: bulbapedia server request has timed out. Did not get color for: Number={i}, Name={pkmn.name}\n"
            print(msg)
            log.write(msg)
            pkmn.color = None
        except AttributeError:
            msg = f"WARN: Did not get color for: Number={i}, Name={pkmn.name}\n"
            print(msg)
            log.write(msg)
            pkmn.color = None

        try:
            # Get first <p> element from pdb
            # Contains gen#, type
            first_para = p_soup.find('p')

            # Get gen#
            # Inside <first_para> abbr
            gen_no = p_soup.find('abbr').text.strip()
            gen_no = int("".join([digit for digit in gen_no if digit.isdigit()]))
            pkmn.gen_no = gen_no

            # Get Type
            # inside <first_para> a.itype
            typing = first_para.find_all('a', class_='itype')

            # Check if dual type
            if len(typing) > 1:
                typing = (typing[0].text.strip(), typing[1].text.strip())
            else:
                typing = (typing[0].text.strip(), )

            pkmn.typing = typing
        except (AttributeError, ValueError):
            msg = f"WARN: Did not get type for: Number={i}, Name={pkmn.name}\n"
            print(msg)
            log.write(msg)
            pkmn.typing = None


        try:
            # Get evolutions
            # inside div.infocard-list-evo
            # if dne, pokemon doesn't evolve
            evo_list = p_soup.find('div', class_='infocard-list-evo')

            # Check if no evos
            if evo_list is None:
                pkmn.related = None
            else:
                evos = evo_list.find_all('div', class_='infocard')
                for evo in evos:
                    data_card = evo.find('span', class_='infocard-lg-data')
                    num = data_card.find('small').text.replace('#', '').strip()
                    pkmn.related.append(int(num))
        except Exception as e:
            msg = f"WARN: {e}. Did not get evolutions for: Number={i}, Name={pkmn.name}\n"
            print(msg)
            log.write(msg)
            pkmn.related = None
            
        # Get official artwork
        try:
            pkmn.pic = download_pic(pkmn.name, i)
        except ConnectTimeout:
            msg = f"WARN: pokemondb server request has timed out. Did not download pic for: Number={i}, Name={pkmn.name}\n"
            print(msg)
            log.write(msg)
            pkmn.pic = None

        if pkmn.pic is None:
            msg = f"Could not get pic for: Number={i}, Name={pkmn.name}\n"
            print(msg)
            log.write(msg)

        try:
            pkmn.serialize()
        except Exception:
            msg = f"Could not save json for: Number={i}, Name={pkmn.name}\n"
            print(msg)
            log.write(msg)

        log.write(f"LOG: Finished {pkmn.name} #{i}\n")

    log.close()
if __name__ == '__main__':
    main()
