// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod pokemon;
use std::{sync::Mutex, rc::Rc, ops::DerefMut};
use serde_json;
use pokemon::*;
use tauri::{State, generate_handler};

const POKEMON_COUNT: usize = 1010;

//TODO Learn how to have a global var here
struct List(Mutex<PokemonList>);

#[tauri::command]
fn init_list(state: State<List>, list: Vec<Pokemon>) {
    state.0.lock().unwrap().init(list);
}

#[tauri::command]
fn send_pokemon(state: State<List>, p: Pokemon) {
    println!("{}", p.name);
    state.0.lock().unwrap().list.push(p);
}

#[tauri::command]
fn set_grade(state: State<List>, json: Pokemon, grade: i32) {
    // let pokemon: Pokemon = serde_json::from_str(json).unwrap();
    state.0.lock().unwrap().set_grade(json, grade);
}

#[tauri::command]
fn get_gradebook(state: State<List>) -> String {
    return state.0.lock().unwrap().get_gradebook();
}

#[tauri::command]
fn get_gradebook_name(state: State<List>) -> String {
    return state.0.lock().unwrap().name.clone();
}

#[tauri::command]
fn set_gradebook_name(state: State<List>, name: String) {
    state.0.lock().unwrap().name = name;
}



fn main() {
    tauri::Builder::default()
        .manage(List(PokemonList::new(POKEMON_COUNT).into()))
        .invoke_handler(tauri::generate_handler![
            init_list,
            send_pokemon,
            set_grade,
            get_gradebook,
            get_gradebook_name,
            set_gradebook_name
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
