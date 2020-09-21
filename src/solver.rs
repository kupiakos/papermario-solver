use serde::Serialize;
use std::collections::VecDeque;
// use serde_wasm_bindgen;
use wasm_bindgen::prelude::*;

#[cfg(debug_assertions)]
use web_sys::console;

type Result<T> = std::result::Result<T, JsValue>;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// TODO: Have the typescript types custom exported correctly.
// Had trouble with wasm_bindgen complaining with function signatures.
#[wasm_bindgen(typescript_custom_section)]
const TYPES: &'static str = r#"
import type {RingMovement} from '../src/movement';
export type RingData = [number, number, number, number];
interface Solution {
    moves: RingMovement[];
    ring: RingData;
}

export function solve(ring: RingData): Solution | null;
"#;

type Ring = [u16; 4];
const NUM_RINGS: u16 = 4;
const NUM_ANGLES: u16 = 12;
const MAX_TURNS: u16 = 3;

#[derive(Serialize)]
#[serde(tag = "type", rename_all="camelCase")]
pub enum RingMovement {
    Ring { r: u16, amount: u16, clockwise: bool },
    Row { th: u16, amount: u16, outward: bool },
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all="camelCase")]
pub struct Solution {
    pub moves: VecDeque<RingMovement>,
    pub result: Ring,
    pub jump_rows: u32,
    pub hammerable_groups: u32,
}

fn rotate_left_masked(mut x: u16, k: u16) -> u16 {
    x <<= 1;
    x |= ((x & (1 << k)) != 0) as u16;
    x &= (1 << k) - 1;
    return x;
}

fn rotate_until_even(x: u16, k: u16) -> u16 {
    let n = x.trailing_ones() as u16;
    let y = x & ((1 << n) - 1);
    return (x >> n) | (y << (k - n));
}

struct RingRotations {
    ring: Ring,
    pub r: u16,
}

impl RingRotations {
    fn new(ring: Ring, r: u16) -> Option<Self> {
        if ring[r as usize] == 0 {
            return None;
        }
        Some(RingRotations {ring, r})
    }
}

impl Iterator for RingRotations {
    type Item = Ring;
    fn next(&mut self) -> Option<Self::Item> {
        {
            let subring = &mut self.ring[self.r as usize];
            *subring = rotate_left_masked(*subring, NUM_ANGLES);
        }
        #[cfg(debug_assertions)]
        console::log_3(
            &JsValue::from("r:"),
            &JsValue::from(self.r),
            &JsValue::from(&format!(
                "\n{:012b}\n{:012b}\n{:012b}\n{:012b}\n",
                self.ring[3], self.ring[2], self.ring[1], self.ring[0])),
        );
        Some(self.ring)
    }
}

struct RingShifts {
    ring: Ring,
    pub th: u16,
    row: u16,
}

impl RingShifts {
    fn new(ring: Ring, th: u16) -> Option<Self> {
        let mut row: u16 = 0;
        // row has 8 bits of data for a full row in shifting order. Positions:
        // Bit 0-3: th: th, r: r
        // Bit 4-7: th: th + 6, r: 7 - r
        // - Bit 0: th: th, r: 0
        // - Bit 1: th: th, r: 1
        // - Bit 2: th: th, r: 2
        // - Bit 3: th: th, r: 3
        // - Bit 4: th: th + 6, r: 3
        // - Bit 5: th: th + 6, r: 2
        // - Bit 6: th: th + 6, r: 1
        // - Bit 7: th: th + 6, r: 0
        for r in 0..4u16 {
            let subring = &ring[r as usize];
            let low = ((*subring & (1 << th)) != 0) as u16;
            let high = ((*subring & (1 << (th + 6))) != 0) as u16;
            row |= low << r;
            row |= high << (7 - r);
        }
        if row == 0 {
            return None;
        }
        Some(RingShifts {ring, th, row})
    }
}

impl Iterator for RingShifts {
    type Item = Ring;
    fn next(&mut self) -> Option<Self::Item> {
        let row = rotate_left_masked(self.row, NUM_RINGS * 2);
        for r in 0..4 {
            let subring = &mut self.ring[r as usize];
            let low = (row & (1 << r) != 0) as u16;
            let high = (row & (1 << (7 - r)) != 0) as u16;
            let th = self.th;
            *subring = (*subring & !(1 << th)) | (low << th);
            *subring = (*subring & !(1 << (th + 6))) | (high << (th + 6));
        }
        #[cfg(debug_assertions)]
        console::log_4(
            &JsValue::from("th:"),
            &JsValue::from(self.th),
            &JsValue::from(&format!("row: {:08b}", row)),
            &JsValue::from(&format!(
                "\n{:012b}\n{:012b}\n{:012b}\n{:012b}\n",
                self.ring[3], self.ring[2], self.ring[1], self.ring[0])),
        );
        self.row = row;
        Some(self.ring)
    }
}

fn all_nonempty_rotations(ring: Ring) -> impl Iterator<Item = (RingMovement, Ring)> {
    (0..NUM_RINGS)
        .filter_map(move |r| RingRotations::new(ring, r))
        .flat_map(|rotates| {
            let r = rotates.r;
            rotates
                .zip(1..NUM_ANGLES)
                .map(move |(rotated, amount)|
            (RingMovement::Ring {amount, r, clockwise: true}, rotated))
        })
}

fn all_nonempty_shifts(ring: Ring) -> impl Iterator<Item = (RingMovement, Ring)> {
    (0..(NUM_ANGLES / 2))
        .filter_map(move |r| RingShifts::new(ring, r))
        .flat_map(|shifts| {
            let th = shifts.th;
            shifts
                .zip(1..(NUM_RINGS * 2))
                .map(move |(shifted, amount)|
            (RingMovement::Row {amount, th, outward: true}, shifted))
        })
}

fn all_nonempty_movements(ring: Ring) -> impl Iterator<Item = (RingMovement, Ring)> {
    all_nonempty_rotations(ring).chain(all_nonempty_shifts(ring))
}

#[wasm_bindgen(skip_typescript)]
pub fn solve(ring: JsValue) -> Result<JsValue> {
    let ring: Ring = serde_wasm_bindgen::from_value(ring)?;
    let solution = find_solution(ring, MAX_TURNS);
    Ok(match solution {
        Some(solution) => serde_wasm_bindgen::to_value(&solution)?,
        None => JsValue::null(),
    })
}

fn find_solution(ring: Ring, max_turns: u16) -> Option<Solution> {
    for turn in 0..max_turns {
        if let Some(solution) = find_solution_at_turn(ring, turn) {
            return Some(solution);
        }
    }
    None
}

fn find_solution_at_turn(ring: Ring, turn: u16) -> Option<Solution> {
    if turn == 0  {
        return get_solution(ring);
    }
    for (movement, moved) in all_nonempty_movements(ring) {
        if let Some(mut solution) = find_solution_at_turn(moved, turn - 1) {
            solution.moves.push_front(movement);
            return Some(solution);
        }
    }
    None
}

fn get_solution(ring: Ring) -> Option<Solution> {
    let enemies: u32 = ring.iter().copied().map(u16::count_ones).sum();
    let outer = ring[2] | ring[3];
    let mut inner = rotate_until_even((ring[0] | ring [1]) & !outer, NUM_ANGLES);
    let actions = enemies / 4 + ((enemies % 4 != 0) as u32);
    let jump_rows = outer.count_ones();
    let mut hammerable_groups = 0;
    while inner != 0 {
        inner &= !(0b11 << inner.trailing_zeros());
        hammerable_groups += 1;
    }
    if hammerable_groups + jump_rows > actions {
        None
    } else {
        Some(Solution {
            moves: VecDeque::new(),
            result: ring,
            jump_rows,
            hammerable_groups,
        })
    }
}

// This is like the `main` function, except for JavaScript.
#[cfg(debug_assertions)]
#[wasm_bindgen(start)]
pub fn main_js() -> Result<()> {
    // This provides better error messages in debug mode.
    // It's disabled in release mode so it doesn't bloat up the file size.
    #[cfg(debug_assertions)]
    console_error_panic_hook::set_once();

    console::log_1(&JsValue::from("Wasm initialized"));

    Ok(())
}