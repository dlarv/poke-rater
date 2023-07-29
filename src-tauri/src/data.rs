use std::{collections::HashMap, fmt::format};
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
pub enum PColors {
    White, Black, Gray, Blue, Red, Green, Pink, Purple, Brown, Yellow
}
#[derive(Deserialize, Serialize, Debug, Clone, Copy, PartialEq, Eq, Hash, EnumIter)]
pub enum StatNames { Attack, Defense, SpAtk, SpDef, Speed, Hp } 

#[derive(Deserialize, Serialize)]
pub struct AutofillRules {
    pub type_rule1: Option<PTypes>,
    pub type_rule2: Option<PTypes>,
    pub gen_rule1: Option<usize>,
    pub gen_rule2: Option<usize>,
    pub grade: i32
}

// total, count
#[derive(Clone, Debug, Serialize)]
pub struct AvgValue<T> (HashMap<T, (f64, f64)>) where T: Clone + Hash + Eq + Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct AvgValuePerGrade<T: Clone + Hash + Eq + Serialize> {
    pub grades: Vec<AvgValue<T>>,
}

impl<T: Clone + Hash + Eq + Serialize> AvgValuePerGrade<T> {
    pub fn new(max_grade: usize) -> AvgValuePerGrade<T>{
        let avg: HashMap<T, (f64, f64)> = HashMap::new();
        let data: Vec<AvgValue<T>> = vec![AvgValue(avg); max_grade];

        return AvgValuePerGrade {
            grades: data,
        };
    }

    pub fn add_value(&mut self, grade: usize, value_type: T, value: f64) {
        match self.grades[grade].0.get_mut(&value_type) {
            Some(g) => {
                g.0 += value;
                g.1 += 1.0;
            },
            None => { 
                self.grades[grade].0.insert(value_type, (value, 1.0));
            }
        };
    }

    pub fn get_result(&mut self) -> Vec<HashMap<T, f64>> {
        let mut output: Vec<HashMap<T, f64>> = Vec::new();
        let mut average:HashMap<T, f64>;
        let mut value: f64; 

        let mut curr_min: f64;
        let mut curr_max: f64;
        for grade in &mut self.grades {
            average = HashMap::new();
 
            for val in &grade.0 {
                value = val.1.0 as f64 / val.1.1 as f64;

                average.insert(val.0.clone(), value);
            }

            // Mark the min and max values with a - or +
            // Used by frontend to color these numbers
            // average = average.iter()
            //     .map(|x| if *x.1 == curr_min.to_string() {
            //         (x.0.clone(), format!("-{}", x.1))} else { (x.0.clone(), x.1.clone()) })
            //     .map(|x| if x.1 == curr_max.to_string() {
            //         (x.0.clone(), format!("+{}", x.1))} else { (x.0.clone(), x.1) })
            //     .collect::<HashMap<T, String>>();

            output.push(average);
        }
        return output;
    }
}



#[derive(Debug, Serialize)]
pub struct AnalysisOutput {
    pub perfect_scores: Vec<String>,
    pub worst_scores: Vec<String>,
    pub gen_average: Vec<f64>,
    pub typing_average: Vec<(PTypes, f64)>,
    pub color_average: Vec<(PColors, f64)>,
    pub dual_type_average: f64,
    pub single_type_average: f64,
    pub manga_average: Vec<f64>,
    pub anime_average: Vec<f64>,

    pub stats_data: Vec<HashMap<StatNames, f64>>,
    pub matchup_data: Vec<HashMap<PTypes, f64>>,
}
