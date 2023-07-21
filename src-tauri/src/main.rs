// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
pub mod pokemon;
pub mod data;

use pokemon::*;
use data::*;
use std::sync::Mutex;
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
fn analyze(state: State<List>, max_grade: i32) {
    /*
     * Generation: avg-grade/gen
     * Typing: avg-grade/type
     * Dual/Single types : Ratio(avg-grade/dual:avg-grade/single)
     * Anime/Manga: avg-#appearances/grade
     * Color: avg-grade/color
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
    run_analysis(&list, max_grade);
}

/* Private functions */

/// Check if pokemon fulfills rules
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

fn run_analysis(list: &Vec<Pokemon>, max_grade: i32) -> AnalysisResults {

    // Count: #pokemon w/ trait, total: sum(grades)
    let mut gen_count = [0; GEN_COUNT];
    let mut gen_totals = [0; GEN_COUNT];
    let mut typing_count = [0; TYPING_COUNT];
    let mut typing_totals = [0; TYPING_COUNT];
    let mut color_count = [0; COLOR_COUNT];
    let mut color_totals = [0; COLOR_COUNT];

    // (dual-total, dual-count, single-total, single-count)
    let mut dual_single_ratio = (0, 0, 0, 0);
    let mut manga_total: Vec<i32> = vec![0; max_grade as usize];
    let mut manga_count = vec![0; max_grade as usize];
    let mut anime_total: Vec<i32> = vec![0; max_grade as usize];
    let mut anime_count = vec![0; max_grade as usize];

    let mut stats_data: AvgValuePerGrade<StatNames> = AvgValuePerGrade::new(max_grade as usize);
    let mut matchup_data: AvgValuePerGrade<PTypes> = AvgValuePerGrade::new(max_grade as usize);

    let mut grade: i32; 
    let mut gen_no: usize;
    for pokemon in list.iter() {
        grade = match pokemon.grade {
            Some(g) => g,
            None => continue
        };

        // avg-grade/generation
        gen_no = pokemon.gen_no - 1; 
        gen_totals[gen_no] += grade;
        gen_count[gen_no] += 1;
        
        // avg-grade/type
        for typing in pokemon.typing.iter() {
            typing_totals[*typing as usize] += grade;
            typing_count[*typing as usize] += 1;
        }

        // dual vs single
        if pokemon.typing.len() == 1 {
            dual_single_ratio.2 += grade;
            dual_single_ratio.3 += 1;
        } else {
            dual_single_ratio.0 += grade;
            dual_single_ratio.1 += 1;
        } 

        // avg-#manga/grade
        manga_total[grade as usize] += pokemon.manga_count as i32;
        manga_count[grade as usize] += 1;

        // avg-#anime/grade
        anime_total[grade as usize] += pokemon.anime_count as i32;
        anime_count[grade as usize] += 1;

        //avg-grade/color
        color_totals[pokemon.color as usize] += grade;
        color_count[pokemon.color as usize] += 1;

        // avg-stat-num/stat-name/grade
        for stat in &pokemon.stats {
            stats_data.add_value(grade as usize, stat.0, stat.1);
        }

        // avg-matchup/type/grade
        for matchup in &pokemon.matchups {
            for typing in matchup.1 {
                matchup_data.add_value(grade as usize, *typing, *matchup.0);
            }
        }
    }
    return AnalysisResults {
        gen_count,
        gen_totals,
        typing_count,
        typing_totals,
        color_count,
        color_totals,
        dual_single_ratio,
        manga_total,
        manga_count,
        anime_total,
        anime_count,
        stats_data,
        matchup_data,
    };
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
        assert_eq!(analysis.get_gen_average(1), 1.0);
    }
    #[test]
    fn test_half_csv() {
        let list = load_csv("half");
        let analysis = run_analysis(&list, 18);
        assert_eq!(analysis.get_typing_average(PTypes::Ghost), 1.3);
    }
    #[test]
    fn test_double_csv() {
        let list = load_csv("double");
        let analysis = run_analysis(&list, 5);
        assert_eq!(analysis.get_typing_average(PTypes::Ghost), 4.0);
    }
}
