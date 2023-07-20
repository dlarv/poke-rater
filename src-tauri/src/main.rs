// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod pokemon;
use std::{sync::Mutex, rc::Rc, ops::DerefMut};
use pokemon::*;
use tauri::{State, generate_handler};
use strum::IntoEnumIterator;

const POKEMON_COUNT: usize = 1010;

type PokemonList = Vec<Pokemon>;

//TODO Learn how to have a global var here
struct List(Mutex<PokemonList>);

#[tauri::command]
fn init_list(state: State<List>, slides: Vec<Vec<Pokemon>>) -> Vec<Vec<usize>>{
    // Receives pokemon in slide order
    // Sort into dex_no order
    // Return slide order 
    
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
    return slide_order;
}

#[tauri::command]
fn get_pokemon_at(state: State<List>, dex_no: usize) -> Pokemon {
    // let output = state.0.lock().unwrap()[dex_no - 1].clone();
    return state.0.lock().unwrap()[dex_no - 1].clone();
}

#[tauri::command]
fn set_grade(state: State<List>, dex_no: usize, grade: i32) {
    let pokemon = &mut state.0.lock().unwrap()[dex_no - 1];
    pokemon.grade = Some(grade);
    println!("Pokemon: {} | Grade: {}", pokemon.name, grade);
}
#[tauri::command]
fn get_all_types() -> Vec<PTypes> {
    return PTypes::iter().collect();
}

fn is_rule_match(pokemon: &Pokemon, rule: &AutofillRules) -> bool {
    let mut is_match = true;
    is_match = match &rule.type_rule1 {
        Some(r) => pokemon.is_typing(r) && is_match,
        None => is_match
    };
    is_match = match &rule.gen_rule1 {
        Some(r) => pokemon.is_gen(*r) && is_match,
        None => is_match
    };
    is_match = match &rule.type_rule2 {
        Some(r) => pokemon.is_typing(r) && is_match,
        None => is_match
    };
    is_match = match &rule.gen_rule2 {
        Some(r) => pokemon.is_gen(*r) && is_match,
        None => is_match
    };
    return is_match;
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
fn get_gradebook(state: State<List>, cursor: usize) -> String {
    let list = state.0.lock().unwrap();
    let mut output: Vec<String> = list.iter().map(|x|x.grade.unwrap_or(-1).to_string()).collect();
    output[cursor - 1].insert(0, '|');
    return output.join(",");
}

fn main() {
    tauri::Builder::default()
        .manage(List(PokemonList::new().into()))
        .invoke_handler(tauri::generate_handler![
            init_list,
            get_all_types,
            autofill,
            get_pokemon_at,
            set_grade,
            get_gradebook,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
