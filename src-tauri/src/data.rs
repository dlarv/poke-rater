use std::collections::HashMap;
use std::hash::Hash;
use serde::{Deserialize, Serialize};
use strum_macros::EnumIter;

pub const POKEMON_COUNT: usize = 1010;
pub const GEN_COUNT: usize = 9;
pub const TYPING_COUNT: usize = 18;
pub const COLOR_COUNT: usize = 10;

#[derive(Deserialize, Serialize, Debug, EnumIter, PartialEq, Clone, Copy, Hash, Eq)]
pub enum PTypes { 
    Normal, Grass, Water, Fire, Electric, 
    Fighting, Flying, Poison, Ground, Psychic,
    Rock, Ice, Bug, Dragon, 
    Ghost, Dark, Steel, Fairy
}
#[derive(Deserialize, Serialize, Debug, Clone, Copy, EnumIter, PartialEq, Eq, Hash)]
pub enum PColor {
    White, Black, Gray, Blue, Red, Green, Pink, Purple, Brown, Yellow
}
#[derive(Deserialize, Serialize, Debug, Clone, Copy, PartialEq, Eq, Hash, EnumIter)]
pub enum StatNames { Attack, Defense, SpAtk, SpDef, Speed, Hp } 

#[derive(Deserialize)]
pub struct AutofillRules {
    pub type_rule1: Option<PTypes>,
    pub type_rule2: Option<PTypes>,
    pub gen_rule1: Option<usize>,
    pub gen_rule2: Option<usize>,
    pub grade: i32
}



// total, count
#[derive(Clone, Debug)]
pub struct AvgValue<T> (HashMap<T, (i32, i32)>) where T: Clone + Hash + Eq;

#[derive(Clone, Debug)]
pub struct AvgValuePerGrade<T: Clone + Hash + Eq> {
    pub grades: Vec<AvgValue<T>>,
}

#[derive(Debug)]
pub struct AnalysisResults {
       // Count: #pokemon w/ trait, total: sum(grades)
    pub gen_count: [i32; GEN_COUNT],
    pub gen_totals: [i32; GEN_COUNT],
    pub typing_count: [i32; TYPING_COUNT],
    pub typing_totals: [i32; TYPING_COUNT],
    pub color_count: [i32; COLOR_COUNT],
    pub color_totals: [i32; COLOR_COUNT],

    // (dual-total, dual-count, single-total, single-count)
    pub dual_single_ratio: (i32, i32, i32, i32),
    pub manga_total: Vec<i32>, 
    pub manga_count: Vec<i32>, 
    pub anime_total: Vec<i32>, 
    pub anime_count: Vec<i32>, 

    pub stats_data: AvgValuePerGrade<StatNames>,
    pub matchup_data: AvgValuePerGrade<PTypes>,
}


impl<T: Clone + Hash + Eq> AvgValuePerGrade<T> {
    pub fn new(max_grade: usize) -> AvgValuePerGrade<T>{
        let avg: HashMap<T, (i32, i32)> = HashMap::new();
        let data: Vec<AvgValue<T>> = vec![AvgValue(avg); max_grade];

        return AvgValuePerGrade {
            grades: data,
        };
    }

    pub fn add_value(&mut self, grade: usize, value_type: T, value: i32) {
        match self.grades[grade].0.get_mut(&value_type) {
            Some(g) => {
                g.0 += value;
                g.1 += 1;
            },
            None => { 
                self.grades[grade].0.insert(value_type, (value, 1));
            }
        };
    }
}

impl AnalysisResults {
    pub fn get_gen_average(&self, index: usize) -> f32 {
        let avg: f32 = (self.gen_totals[index] as f32) / (self.gen_count[index] as f32);
        return avg;
    }
    pub fn get_typing_average(&self, typing: PTypes) -> f32 {
        let avg: f32 = (self.typing_totals[typing as usize] as f32) / (self.typing_count[typing as usize] as f32);
        return avg;
    }
}
