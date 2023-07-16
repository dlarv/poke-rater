use std::collections::HashMap;

use serde::Deserialize;
#[derive(Deserialize)]
pub enum PTypes { 
    Normal, Grass, Water, Fire, Electric, 
    Fighting, Flying, Poison, Ground, Psychic,
    Rock, Ice, Bug, Dragon, 
    Ghost, Dark, Steel, Fairy
}
#[derive(Deserialize)]
pub enum PColor {
    White, Black, Gray, Blue, Red, Green, Pink, Purple
}
#[derive(Deserialize)]
pub enum StatNames { Attack, Defense, SpAtk, SpDef, Speed, Hp }

pub struct PokemonList {
    list: Vec<Pokemon>,
    grades: Vec<i32>
}

#[derive(Deserialize)]
pub struct Pokemon {
    pub name: String,
    pub dex_no: usize,
    color: PColor,
    gen_no: i32,
    typing: (PTypes, PTypes),
    stats: Vec<(StatNames, i32)>,
    matchups: HashMap<i32, Vec<PTypes>>,
}


impl PokemonList {
    pub fn new(count: usize) -> PokemonList {
        return PokemonList {
            list: Vec::with_capacity(count),
            grades: Vec::with_capacity(count)
        };
    }

    pub fn set_grade(mut self, pokemon: Pokemon, grade: i32) {
        let num: usize = pokemon.dex_no;
        self.grades[num] = grade;
        
        if self.list[num] != pokemon {
            self.list[num] = pokemon;
        }
    }
}


impl Pokemon {
    // fn new()
}
impl PartialEq for Pokemon {
    fn eq(&self, other: &Self) -> bool {
        return self.dex_no == other.dex_no;
    }
}