// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
pub mod pokemon;
pub mod data;

use pokemon::*;
use data::*;
use std::{sync::Mutex, iter::zip, collections::HashMap, hash::Hash, fs};
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
     * Item with "|" char is starting number.
     * Return that number or 0
     */
    const CURSOR: char = '|';
    let mut list = state.0.lock().unwrap();
    let grades = csv.split(",");
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
    // json data omits neutral matchups. 
    // All types not included in pokemon.matchup must add 100
    let mut typing_list: Vec<PTypes>;

    let mut grade; 
    let mut gen_no: usize;
    for pokemon in list.iter() {
        grade = match pokemon.grade {
            Some(g) => (g - 1) as f64,
            None => continue
        };

        // pokemon with a perfect grade
        if grade == (num_grades - 1) as f64 {
            perfect_scores.push(String::from(&pokemon.name))
        }
        else if grade == 0.0 {
            worst_scores.push(String::from(&pokemon.name))
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
        // println!("{} {}", pokemon.name, pokemon.dex_no);

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
        if grade == 5.0 {
            println!("{}: {:?}", pokemon.name, pokemon.matchups)
        }
        typing_list = PTypes::iter().collect();
        for matchup in &pokemon.matchups {
            for typing in matchup.1 {
                matchup_data.add_value(grade as usize, *typing, *matchup.0 as f64);
                typing_list.remove(typing_list.iter().position(|x| x == typing).unwrap());
            }
        }
        // Add neutral matchups
        for matchup in typing_list {
            matchup_data.add_value(grade as usize, matchup, 100.0);
        }
    }
    // println!("{:#?}", matchup_data.grades[5]);
    // Calculate and Sort outputs
    let mut typing_output: Vec<(PTypes, f64)> = typing_data.into_iter().map(|x| (x.0, x.1.0 / x.1.1)).collect();
    typing_output.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap());

    let mut color_output: Vec<(PColors, f64)> = color_data.into_iter().map(|x| (x.0, x.1.0 / x.1.1)).collect();
    color_output.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap());

    // Add +/- to manga/anime counts
    let manga_average: Vec<f64> = zip(manga_totals, manga_count).map(|x| x.0 / x.1).collect();
    let manga_max_count = manga_average.iter().max_by(|x,y| x.total_cmp(y)).unwrap_or(&-1.0);
    let manga_min_count = manga_average.iter().min_by(|x,y| x.total_cmp(y)).unwrap_or(&-1.0);

    let anime_average: Vec<f64> = zip(anime_totals, anime_count).map(|x| x.0 / x.1).collect();
    let anime_max_count = anime_average.iter().max_by(|x,y| x.total_cmp(y)).unwrap_or(&-1.0);
    let anime_min_count = anime_average.iter().min_by(|x,y| x.total_cmp(y)).unwrap_or(&-1.0);

    let check_max_min = |x: &f64, max, min| if x == max { format!("+{}", x) } else if x == min { format!("-{}", x) } else { x.to_string() }; 

    return AnalysisOutput {
        perfect_scores,
        worst_scores,
        gen_average: zip(gen_totals, gen_count).map(|x| x.0 / x.1).collect(),
        typing_average: typing_output,
        color_average: color_output,
        dual_type_average: dual_type_total / dual_type_count,
        single_type_average: single_type_total / single_type_count,
        manga_average: manga_average.iter()
            .map(|x| check_max_min(x, manga_max_count, manga_min_count))
            .collect(),
        anime_average: anime_average.iter()
            .map(|x| check_max_min(x, anime_max_count, anime_min_count))
            .collect(),
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

        let grades = csv.split(",");
        
        for grade in grades.enumerate() {
            if grade.0 == POKEMON_COUNT {
                break;
            }
            list[grade.0].grade = Some(grade.1.parse::<i32>().unwrap_or(0));
        }
        return list;
    }

    #[test]
    fn test_generation_avg() {
        let list = load_csv("generation");
        let analysis = run_analysis(&list, 9);
        assert_eq!(analysis.gen_average[0], 0.0);
        assert_eq!(analysis.gen_average[1], 1.0);
        assert_eq!(analysis.gen_average[2], 2.0);
        assert_eq!(analysis.gen_average[3], 3.0);
        assert_eq!(analysis.gen_average[4], 4.0);
        assert_eq!(analysis.gen_average[5], 5.0);
        assert_eq!(analysis.gen_average[6], 6.0);
        assert_eq!(analysis.gen_average[7], 7.0);
        assert_eq!(analysis.gen_average[8], 8.0);
    }

    #[test]
    fn test_typing_avg() {
        let list = load_csv("typing");
        let analysis = run_analysis(&list, 18);
        for avg in analysis.typing_average {
            match avg.0 {
                PTypes::Normal => 
                    assert_eq!(avg.1, 0.5846153846153846),
                PTypes::Grass => 
                    assert_eq!(avg.1, 2.7049180327868854),
                PTypes::Water => 
                    assert_eq!(avg.1, 2.9285714285714284),
                PTypes::Fire => 
                    assert_eq!(avg.1, 4.5375),
                PTypes::Electric => 
                    assert_eq!(avg.1, 4.705882352941177),
                PTypes::Fighting => 
                    assert_eq!(avg.1, 5.819444444444445),
                PTypes::Flying => 
                    assert_eq!(avg.1, 6.302752293577981),
                PTypes::Poison =>   
                    assert_eq!(avg.1, 7.0),
                PTypes::Ground => 
                    assert_eq!(avg.1, 7.8133333333333335),
                PTypes::Psychic => 
                    assert_eq!(avg.1, 8.535353535353535),
                PTypes::Rock => 
                    assert_eq!(avg.1, 9.63013698630137),
                PTypes::Ice => 
                    assert_eq!(avg.1, 9.9375),
                PTypes::Bug => 
                    assert_eq!(avg.1, 11.467391304347826),
                PTypes::Dragon =>
                    assert_eq!(avg.1, 10.507692307692308),
                PTypes::Ghost => 
                    assert_eq!(avg.1, 11.370967741935484),
                PTypes::Dark => 
                    assert_eq!(avg.1, 11.666666666666666),
                PTypes::Steel => 
                    assert_eq!(avg.1, 12.698412698412698),
                PTypes::Fairy => 
                    assert_eq!(avg.1, 11.777777777777779)
            }
        }
    }

    #[test]
    fn test_numtypes_avg() {
        let list = load_csv("numtypes");
        let analysis = run_analysis(&list, 2);
        assert_eq!(analysis.dual_type_average, 1.0);
        assert_eq!(analysis.single_type_average, 0.0);
    }

    #[test]
    fn test_color_avg() {
        let list = load_csv("color");
        let analysis = run_analysis(&list, 18);
        for color in analysis.color_average {
            match color.0 {
                PColors::White => 
                    assert_eq!(color.1, 8.0),
                PColors::Black => 
                    assert_eq!(color.1, 0.0),
                PColors::Gray => 
                    assert_eq!(color.1, 3.0),
                PColors::Blue => 
                    assert_eq!(color.1, 1.0),
                PColors::Red => 
                    assert_eq!(color.1, 7.0),
                PColors::Green => 
                    assert_eq!(color.1, 4.0),
                PColors::Pink => 
                    assert_eq!(color.1, 5.0),
                PColors::Purple => 
                    assert_eq!(color.1, 6.0),
                PColors::Brown => 
                    assert_eq!(color.1, 2.0),
                PColors::Yellow => 
                    assert_eq!(color.1, 9.0),
            }
        }
    }

    #[test]
    fn test_best_worst() {
        let list = load_csv("best_worst");
        let analysis = run_analysis(&list, 3);
        let perfect_scores = ["Bulbasaur", "Chickorita", "Suicune","Treecko","Rayquaza", "Turtwig","Giratina"];
        let worst_scores = ["Charizard", "Dragonite", "Typhlosion","Tyranitar", "Blaziken", "Metagross","Salamence", "Infernape", "Garchomp"];

        for perfect in analysis.perfect_scores {
            assert!(perfect_scores.contains(&perfect.as_str()));
        } 
        for worst in analysis.worst_scores {
            assert!(worst_scores.contains(&worst.as_str()));
        }
    }

    #[test]
    fn test_appearances() {
        // Each gen inc(0 -> 9)
        let list = load_csv("generation");
        let analysis = run_analysis(&list, 9);
        // avg appearances per gen
        let anime_count = [36.76158940397351, 22.07, 15.451851851851853, 10.299065420560748, 10.833333333333334, 7.833333333333333, 4.829545454545454, 2.8541666666666665, 0.26666666666666666];
        
        for avg in zip(analysis.anime_average, anime_count) {
            assert_eq!(avg.0.replace('+', "").replace('-', ""), avg.1.to_string());
        }
    }
    #[test]
    fn test_matchups() {
        let list = load_csv("matchups");
        let analysis = run_analysis(&list, 4);

        println!("{:?}", analysis.matchup_data[2]);
        // All pure ghost types are 2
        assert_eq!(analysis.matchup_data[2][&PTypes::Normal], "-0");
        assert_eq!(analysis.matchup_data[2][&PTypes::Ghost], "+200");
        
        // All pure normal types are 3
        assert_eq!(analysis.matchup_data[3][&PTypes::Fighting], "+200");
        assert_eq!(analysis.matchup_data[3][&PTypes::Ghost], "-0");

        // All Dragon +(flying|ground|grass) are 1
        assert_eq!(analysis.matchup_data[1][&PTypes::Dragon], "200");
        assert_eq!(analysis.matchup_data[1][&PTypes::Ice], "+400");
    }
    #[test]
    fn test_stats() {
        let list = load_csv("stats");
        let analysis = run_analysis(&list,3);
        
        // att > 150 -> 3
        println!("{}", analysis.stats_data[2][&StatNames::Attack]);
        assert!(analysis.stats_data[2][&StatNames::Attack].parse::<f64>().unwrap() >= 150.0);
        // def > 150 -> 2
        assert!(analysis.stats_data[1][&StatNames::Defense].parse::<f64>().unwrap() >= 150.0);

        assert!(analysis.stats_data[0][&StatNames::Attack].parse::<f64>().unwrap() < 150.0);
        
    }
}
