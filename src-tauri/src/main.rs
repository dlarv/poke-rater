// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod pokemon;
use std::{sync::Mutex, rc::Rc, ops::DerefMut};

use pokemon::*;
use tauri::State;

const POKEMON_COUNT: usize = 1010;

//TODO Learn how to have a global var here
struct List(Mutex<PokemonList>);

#[tauri::command]
fn set_grade(state: State<List>, pokemon: Pokemon, grade: i32) {
    
}

fn main() {
    tauri::Builder::default()
        .manage(List(PokemonList::new(POKEMON_COUNT).into()))
        .invoke_handler(tauri::generate_handler![
            set_grade,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
