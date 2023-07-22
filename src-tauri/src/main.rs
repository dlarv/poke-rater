// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
pub mod pokemon;
pub mod data;

use pokemon::*;
use data::*;
use std::{sync::Mutex, iter::zip, collections::HashMap, hash::Hash};
use tauri::{State, Manager};
use strum::IntoEnumIterator;

type PokemonList = Vec<Pokemon>;
type Slides = Option<Vec<Vec<usize>>>;
struct List(Mutex<PokemonList>, Mutex<Slides>);

#[tauri::command]
fn init_list(state: State<List>, slides: Vec<Vec<Pokemon>>) -> Vec<Vec<usize>>{
    // Receives pokemon in slide order
    // Sort into dex_no order
    // Return slide order 

    if let Some(s) = state.1.lock().unwrap().clone() {
        return s;
    }

    let mut list = state.0.lock().unwrap();

    let mut slide_order: Vec<Vec<usize>> = Vec::with_capacity(slides.len());
    let mut current_slide: Vec<usize>;

    for slide in slides {
        current_slide = Vec::with_capacity(slide.len());
        
        for pokemon in slide {
            current_slide.push(pokemon.dex_no);
            list.push(pokemon);
        }

        slide_order.push(current_slide);
    }
    list.sort();
    *state.1.lock().unwrap() = Some(slide_order.clone());
    return slide_order;
}

#[tauri::command]
fn get_pokemon_at(state: State<List>, dex_no: usize) -> Pokemon {
    let output = state.0.lock().unwrap()[dex_no - 1].clone();
    return output;
}

#[tauri::command]
fn set_grade(state: State<List>, dex_no: usize, grade: i32) {
    let pokemon = &mut state.0.lock().unwrap()[dex_no - 1];
    pokemon.grade = Some(grade);
    println!("Pokemon: {} | Grade: {}", pokemon.name, grade);
}

#[tauri::command]
fn list_ptypes() -> Vec<PTypes> {
    return PTypes::iter().collect();
}

#[tauri::command]
fn autofill(state: State<List>, rules: Vec<AutofillRules>) {
    let mut list = state.0.lock().unwrap();
    
    let mut pokemon: &mut Pokemon;
    for i in 0..list.len() {
        pokemon = &mut list[i];
        for rule in &rules {
            if is_rule_match(pokemon, rule) {
                pokemon.grade = Some(rule.grade);
            }
        }
    }
}

#[tauri::command]
fn get_gradebook_csv(state: State<List>, slide_index: usize) -> String {
    let list = state.0.lock().unwrap();
    let mut output: Vec<String> = list.iter().map(|x|x.grade.unwrap_or(0).to_string()).collect();
    output[slide_index - 1].insert(0, '|');
    return output.join(",");
}


#[tauri::command]
fn parse_csv_file(state: State<List>, csv: String) -> usize {
    /*!
     * Takes csv, where items are grades in dex order.
     * Item with '|' char is starting number.
     * Return that number or 0
     */
    const CURSOR: char = '|';
    let mut list = state.0.lock().unwrap();
    let grades = csv.split(',');
    let mut start_pos: usize = 0;

    for grade in grades.enumerate() {
        // Exit if file is too long
        if grade.0 == POKEMON_COUNT {
            break;
        }
        if grade.1.contains(CURSOR) {
            start_pos = grade.0;
            list[grade.0].grade = Some(grade.1.replace(CURSOR, "").parse::<i32>().unwrap_or(0));
        } 
        else {
            list[grade.0].grade = Some(grade.1.parse::<i32>().unwrap_or(0));
        }
    }
    return start_pos;
}


#[tauri::command]
fn analyze(state: State<List>, num_grades: i32) -> AnalysisOutput {
    //! num_grades is total number of discrete grades
    /*
     * Generation: avg-grade/gen
     * Typing: avg-grade/type
     * Dual/Single types : Ratio(avg-grade/dual:avg-grade/single)
     * Anime/Manga: avg-#appearances/grade
     * Color: avg-grade/color
     * Perfect scores: list of names&dex_no of pokemon with max score
     * Worst scores: see perfect scores
     * 
     * ----------Uses AvgValuePerGrade struct----------
     * Stats
     *  - avg-stat-num/stat-name/grade
     * Weaknesses 
     *  - avg-matchup/type/grade
     * 
     * ----------Unimplemented in .json----------
     * Number of evolutions: avg-#evo/grade
     * 
     * Number of forms: avg-#forms/grade
     */
    let list = state.0.lock().unwrap();
    return run_analysis(&list, num_grades);
}

/* Private functions */

/// Check if pokemon fulfills rules
fn run_analysis(list: &Vec<Pokemon>, num_grades: i32) -> AnalysisOutput {

    // {Name} ({dexno})
    let mut perfect_scores: Vec<String> = Vec::new();
    let mut worst_scores: Vec<String> = Vec::new();

    // Count: #pokemon w/ trait, total: sum(grades)
    let mut gen_count = [0.0; GEN_COUNT];
    let mut gen_totals = [0.0; GEN_COUNT];

    let mut typing_data: HashMap<PTypes, (f64, f64)> = HashMap::new();
    let mut color_data: HashMap<PColors, (f64, f64)> = HashMap::new();

    // (dual-total, dual-count, single-total, single-count)
    let mut single_type_total = 0.0;   
    let mut single_type_count = 0.0;
    let mut dual_type_total = 0.0;   
    let mut dual_type_count = 0.0;    
    let mut manga_totals = vec![0.0; num_grades as usize];
    let mut manga_count = vec![0.0; num_grades as usize];
    let mut anime_totals = vec![0.0; num_grades as usize];
    let mut anime_count = vec![0.0; num_grades as usize];

    // vec of hashmaps where key = StatName|PType, value = (total, count)
    let mut stats_data: AvgValuePerGrade<StatNames> = AvgValuePerGrade::new(num_grades as usize);
    let mut matchup_data: AvgValuePerGrade<PTypes> = AvgValuePerGrade::new(num_grades as usize);

    let mut grade; 
    let mut gen_no: usize;
    for pokemon in list.iter() {
        grade = match pokemon.grade {
            Some(g) => (g - 1) as f64,
            None => continue
        };

        // pokemon with a perfect grade
        if grade == (num_grades - 1) as f64 {
            perfect_scores.push(format!("{} ({:04})", pokemon.name, pokemon.dex_no))
        }
        else if (grade == 0.0) {
            worst_scores.push(format!("{} ({:04})", pokemon.name, pokemon.dex_no))
        }

        // avg-grade/generation
        gen_no = pokemon.gen_no - 1; 
        gen_totals[gen_no] += grade;
        gen_count[gen_no] += 1.0;
        
        // avg-grade/type
        for typing in pokemon.typing.iter() {
            if typing_data.contains_key(typing) {
                typing_data.get_mut(typing).unwrap().0 += grade;
                typing_data.get_mut(typing).unwrap().1 += 1.0;
            } else {
                typing_data.insert(*typing, (grade, 1.0));
            }
        }

        // dual vs single
        if pokemon.typing.len() == 1 {
            single_type_total += grade;
            single_type_count += 1.0;
        } else {
            dual_type_total += grade;
            dual_type_count += 1.0;
        } 
        println!("{} {}", pokemon.name, pokemon.dex_no);

        // avg-#manga/grade
        manga_totals[grade as usize] += pokemon.manga_count as f64;
        manga_count[grade as usize] += 1.0;

        // avg-#anime/grade
        anime_totals[grade as usize] += pokemon.anime_count as f64;
        anime_count[grade as usize] += 1.0;

        //avg-grade/color
        
        if color_data.contains_key(&pokemon.color) {
            color_data.get_mut(&pokemon.color).unwrap().0 += grade;
            color_data.get_mut(&pokemon.color).unwrap().1 += 1.0;
        } else {
            color_data.insert(pokemon.color, (grade, 1.0));
        }

        // avg-stat-num/stat-name/grade
        for stat in &pokemon.stats {
            stats_data.add_value(grade as usize, stat.0, stat.1 as f64);
        }

        // avg-matchup/type/grade
        for matchup in &pokemon.matchups {
            for typing in matchup.1 {
                matchup_data.add_value(grade as usize, *typing, *matchup.0 as f64);
            }
        }
    }
    // Calculate and Sort outputs
    let mut typing_output: Vec<(PTypes, f64)> = typing_data.into_iter().map(|x| (x.0, x.1.0 / x.1.1)).collect();
    typing_output.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap());

    let mut color_output: Vec<(PColors, f64)> = color_data.into_iter().map(|x| (x.0, x.1.0 / x.1.1)).collect();
    color_output.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap());

    return AnalysisOutput {
        perfect_scores,
        worst_scores,
        gen_average: zip(gen_totals, gen_count).map(|x| x.0 / x.1).collect(),
        typing_average: typing_output,
        color_average: color_output,
        dual_type_average: dual_type_total / dual_type_count,
        single_type_average: single_type_total / single_type_count,
        manga_average: zip(manga_totals, manga_count).map(|x| x.0 / x.1).collect(),
        anime_average: zip(anime_totals, anime_count).map(|x| x.0 / x.1).collect(),
        stats_data: stats_data.get_result(),
        matchup_data: matchup_data.get_result(),
    };
}

fn is_rule_match(pokemon: &Pokemon, rule: &AutofillRules) -> bool {
    let mut is_match = true;
    is_match = match &rule.type_rule1 {
        Some(r) => pokemon.is_typing(r) && is_match,
        None => is_match
    };
    is_match = match &rule.gen_rule1 {
        Some(r) => pokemon.is_gen(r) && is_match,
        None => is_match
    };
    is_match = match &rule.type_rule2 {
        Some(r) => pokemon.is_typing(r) && is_match,
        None => is_match
    };
    is_match = match &rule.gen_rule2 {
        Some(r) => pokemon.is_gen(r) && is_match,
        None => is_match
    };
    return is_match;
}

fn main() {
    tauri::Builder::default()
        .manage(List(PokemonList::new().into(), None.into()))
        .invoke_handler(tauri::generate_handler![
            init_list,
            list_ptypes,
            autofill,
            get_pokemon_at,
            set_grade,
            get_gradebook_csv,
            parse_csv_file,
            analyze,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)] // only include this code on debug builds
            {
              let window = app.get_window("main").unwrap();
              window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{io::Read, fs::{File, self}};
    use serde_json;

    const PATH_ROOT: &str = "test-csvs";
    const JSON_PATH: &str = "test-csvs/slides.json";
    
    /*
     * 1. Basic 'values-make sense'
     * 2. CSV.len() < Pokemon Total
     * 3. CSV.len() > Pokemon Total
     */

    fn load_pokemon_json() -> Vec<Pokemon> {
        let file = fs::read_to_string(JSON_PATH).expect("Could not open slides.json");
        //File::open(JSON_PATH).expect("Could not open slides.json");
        
        let slides: Vec<Vec<Pokemon>> = serde_json::from_str(&file).expect("Could not open slides.json");
        
        let mut list: Vec<Pokemon> = Vec::new();
        for slide in slides {
            for pokemon in slide {
                list.push(pokemon);
            }
        }
        list.sort();
        return list;
    }
    fn get_path_name(file_name: &str) -> String {
        return format!("{}/{}.csv", PATH_ROOT, file_name);
    }
    fn load_csv(file_name: &str) -> Vec<Pokemon>{
        let path = get_path_name(file_name);
        // let mut list = List(load_pokemon_json().into());
        let mut list = load_pokemon_json();
        let mut file: String = String::new();
        
        File::open(path).expect("").read_to_string(&mut file).expect("");

        let csv = file.split("\n").last().expect("Could not split newlines").to_string();

        let grades = csv.split(',');
        
        for grade in grades.enumerate() {
            if grade.0 == POKEMON_COUNT {
                break;
            }
            list[grade.0].grade = Some(grade.1.parse::<i32>().unwrap_or(0));
        }
        return list;
    }

    #[test]
    fn test_is_reasonable_vals() {
        let list = load_csv("reasonable");
        let analysis = run_analysis(&list, 18);
        assert_eq!(analysis.gen_average[1], 1.0);
    }

}
