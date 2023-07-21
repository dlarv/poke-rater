use crate::data::*;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Pokemon {
    pub grade: Option<i32>,
    pub name: String,
    pub dex_no: usize,
    pub color: PColor,
    pub gen_no: usize,
    pub typing: Vec<PTypes>,
    pub stats: Vec<(StatNames, i32)>,
    pub matchups: HashMap<i32, Vec<PTypes>>,
    pub manga_count: usize,
    pub anime_count: usize,
}

impl Pokemon {
    // fn new()
    pub fn is_typing(&self, typing: &PTypes) -> bool {
        return self.typing.contains(&typing);
    }
    pub fn is_gen(&self, gen: &usize) -> bool {
        return &self.gen_no == gen;
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

