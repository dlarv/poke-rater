use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use strum_macros::EnumIter;


#[derive(Deserialize, Serialize, Debug, EnumIter, PartialEq, Clone, Copy)]
pub enum PTypes { 
    Normal, Grass, Water, Fire, Electric, 
    Fighting, Flying, Poison, Ground, Psychic,
    Rock, Ice, Bug, Dragon, 
    Ghost, Dark, Steel, Fairy
}
#[derive(Deserialize, Serialize, Debug, Clone, Copy)]
pub enum PColor {
    White, Black, Gray, Blue, Red, Green, Pink, Purple, Brown, Yellow
}
#[derive(Deserialize, Serialize, Debug, Clone, Copy)]
pub enum StatNames { Attack, Defense, SpAtk, SpDef, Speed, Hp }

#[derive(Deserialize)]
pub struct AutofillRules {
    pub type_rule1: Option<PTypes>,
    pub type_rule2: Option<PTypes>,
    pub gen_rule1: Option<i32>,
    pub gen_rule2: Option<i32>,
    pub grade: i32
}

pub struct _PokemonList {
    pub name: String,
    pub list: Vec<Pokemon>,
    grades: Vec<i32>,

}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Pokemon {
    pub grade: Option<i32>,
    pub name: String,
    pub dex_no: usize,
    color: PColor,
    gen_no: i32,
    typing: Vec<PTypes>,
    stats: Vec<(StatNames, i32)>,
    matchups: HashMap<i32, Vec<PTypes>>,
}


impl _PokemonList {
    pub fn new(count: usize) -> _PokemonList {
        return _PokemonList {
            name: String::from("default"),
            list: Vec::with_capacity(count),
            grades: Vec::with_capacity(count)
        };
    }

    pub fn init(&mut self, list: Vec<Pokemon>) {
        self.grades = vec![0; list.len()];
        self.list = list;
    }

    pub fn set_grade(&mut self, pokemon: Pokemon, grade: i32) {
        let num: usize = pokemon.dex_no - 1;
        println!("{}: {}", pokemon.name, grade);
        if self.list[num] != pokemon {
            self.list[num] = pokemon;
        }
        self.grades[num] = grade;
    }

    pub fn get_gradebook(&self) -> String {
        return self.grades.iter().map(|x| x.to_string() + ",").collect();
    }
    pub fn set_name(&mut self, name: String) {
        self.name = name;
    }
}


impl Pokemon {
    // fn new()
    pub fn is_typing(&self, typing: &PTypes) -> bool {
        return self.typing.contains(&typing);
    }
    pub fn is_gen(&self, gen: i32) -> bool {
        return self.gen_no == gen;
    }
}
impl PartialEq for Pokemon {
    fn eq(&self, other: &Self) -> bool {
        return self.dex_no == other.dex_no;
    }
}
impl Eq for Pokemon {
    fn assert_receiver_is_total_eq(&self) {}
}
impl PartialOrd for Pokemon {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        return self.dex_no.partial_cmp(&other.dex_no);
    }
}
impl Ord for Pokemon {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        return self.dex_no.cmp(&other.dex_no);
    }
}