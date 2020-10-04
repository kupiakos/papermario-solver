use serde::Serialize;
use arrayvec::ArrayVec;
use std::collections::VecDeque;
use wasm_bindgen::prelude::*;

#[cfg(debug_assertions)]
use web_sys::console;

type Result<T> = std::result::Result<T, JsValue>;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// The data contained in a ring.
/// It's organized where each index is a subring, from inner to outer.
/// The 12 lower bits of each element is set if there is an enemy at that angle.
/// The lowest bit is angle 0, and it goes clockwise from there.
type Ring = [u16; 4];
const NUM_RINGS: u16 = 4;
const NUM_ANGLES: u16 = 12;
const MAX_TURNS: u16 = 4;

/// A Rust version of a RingMovement.
#[derive(Serialize)]
#[serde(tag = "type", rename_all="camelCase")]
pub enum RingMovement {
    Ring { r: u16, amount: i16, clockwise: bool },
    Row { th: u16, amount: i16, outward: bool },
}

/// Represents a solution to the problem.
#[derive(Serialize)]
#[serde(tag = "type", rename_all="camelCase")]
pub struct Solution {
    pub moves: VecDeque<RingMovement>,
    pub result: Ring,
    pub jump_rows: u32,
    pub hammerable_groups: u32,
}

/// A MaskedInt allows rotation of its internal bits.
trait MaskedInt: Sized + Copy {
    const NUM_BITS: u16;
    fn new(value: u16) -> Self;
    fn value(self) -> u16;

    /// Rotate the value left by N bits.
    fn rotate_left(self, n: u16) -> Self {
        let x = self.value();
        let n = n % Self::NUM_BITS;
        let m = ((1 << n) - 1) << (Self::NUM_BITS - n);
        let y = (x & m) >> (Self::NUM_BITS - n);
        return Self::new(((x << n) | y) & ((1 << Self::NUM_BITS) - 1));
    }

    /// Rotate the value right by N bits.
    fn rotate_right(self, n: u16) -> Self {
        let x = self.value();
        let n = n % Self::NUM_BITS;
        let m = (1 << n) - 1;
        let y = (x & m) << (Self::NUM_BITS - n);
        return Self::new((x >> n) | y);
    }
}

/// The data contained in a subring, the same format as in Row, with 12 bits.
#[derive(Clone, Copy, PartialEq, Eq)]
struct Subring(pub u16);
impl MaskedInt for Subring {
    const NUM_BITS: u16 = NUM_ANGLES;

    fn new(value: u16) -> Self {
        Self(value)
    }

    fn value(self) -> u16 {
        self.0
    }
}

/// The data contained in a full row in shifting order, with 8 bits.
///
/// The lowest bit is the closest cell in an angle.
/// The next three bits are in the same angle, moving outwards.
/// Then, the fourth bit is the farthest cell in the opposite angle (same row).
/// The next three bits are in that opposite angle, moving inwards.
#[derive(Clone, Copy, PartialEq, Eq)]
struct Row(pub u16);
impl MaskedInt for Row {
    const NUM_BITS: u16 = NUM_RINGS * 2;

    fn new(value: u16) -> Self {
        Self(value)
    }

    fn value(self) -> u16 {
        self.0
    }
}

/// An iterator that "zig-zag" rotates its bits higher and higher amounts.
/// Compared to the original input, its outputs are:
/// - rotate left 1
/// - rotate right 1
/// - rotate left 2
/// - rotate right 2
/// - rotate left 3
/// - rotate right 3
/// - And so on.
///
/// This is used to iterate through the smallest movements first.
///
/// # Example
/// ```
/// let z = ZigZagBits::new(Row(0b00000010));
/// assert_eq!(z.next(), Some(Row(0b00000100)));
/// assert_eq!(z.next(), Some(Row(0b00000001)));
/// assert_eq!(z.next(), Some(Row(0b00001000)));
/// assert_eq!(z.next(), Some(Row(0b10000000)));
/// assert_eq!(z.next(), Some(Row(0b00010000)));
/// assert_eq!(z.next(), Some(Row(0b01000000)));
/// assert_eq!(z.next(), Some(Row(0b00100000)));
/// ```
struct ZigZagBits<T: MaskedInt> {
    data: T,
    amount: i16,
}

impl<T: MaskedInt> ZigZagBits<T> {
    fn new(data: T) -> Self {
        ZigZagBits { data, amount: 0 }
    }
}

impl<T: MaskedInt> Iterator for ZigZagBits<T> {
    type Item = (T, i16);
    fn next(&mut self) -> Option<Self::Item> {
        let new_amount = -self.amount + ((self.amount <= 0) as i16);
        let diff = new_amount - self.amount;
        #[cfg(debug_assertions)]
        console::log_3(
            &JsValue::from(self.amount),
            &JsValue::from(new_amount),
            &JsValue::from(diff));
        self.data = if diff > 0 {
            self.data.rotate_left(diff as u16)
        } else {
            self.data.rotate_right(-diff as u16)
        };
        self.amount = new_amount;
        Some((self.data, new_amount))
    }
}

/// An iterator over all rotations for a subring, smallest first.
struct RingRotations {
    ring: Ring,
    pub r: u16,
    subring_iter: ZigZagBits<Subring>,
}

impl RingRotations {
    fn new(ring: Ring, r: u16) -> Option<Self> {
        let subring = Subring(ring[r as usize]);
        if subring.0 == 0 {
            return None;
        }
        let subring_iter = ZigZagBits::new(subring);
        Some(RingRotations {ring, r, subring_iter})
    }
}

impl Iterator for RingRotations {
    type Item = (Ring, RingMovement);
    fn next(&mut self) -> Option<Self::Item> {
        let (subring, amount) = self.subring_iter.next()?;
        self.ring[self.r as usize] = subring.value();
        #[cfg(debug_assertions)]
        console::log_1(
            &JsValue::from(&format!(
                "r: {}, amount: {}, \n{:012b}\n{:012b}\n{:012b}\n{:012b}\n",
                self.r, amount, self.ring[3], self.ring[2], self.ring[1], self.ring[0]
            )),
        );
        Some((self.ring, RingMovement::Ring {
            r: self.r,
            amount: amount.abs(),
            clockwise: amount > 0,
        }))
    }
}

/// An iterator over all shifts for a row, smallest first.
struct RingShifts {
    ring: Ring,
    pub th: u16,
    row_iter: ZigZagBits<Row>,
}

impl RingShifts {
    fn new(ring: Ring, th: u16) -> Option<Self> {
        let mut row: u16 = 0;
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
        let row_iter = ZigZagBits::new(Row(row));
        Some(RingShifts {ring, th, row_iter})
    }
}

impl Iterator for RingShifts {
    type Item = (Ring, RingMovement);
    fn next(&mut self) -> Option<Self::Item> {
        let (row, amount) = self.row_iter.next()?;
        let row = row.value();
        for r in 0..4 {
            let subring = &mut self.ring[r as usize];
            let low = (row & (1 << r) != 0) as u16;
            let high = (row & (1 << (7 - r)) != 0) as u16;
            let th = self.th;
            *subring = (*subring & !(1 << th)) | (low << th);
            *subring = (*subring & !(1 << (th + 6))) | (high << (th + 6));
        }
        #[cfg(debug_assertions)]
        console::log_1(
            &JsValue::from(&format!(
                "th: {}, amount: {}, row: {:08b}\n{:012b}\n{:012b}\n{:012b}\n{:012b}\n",
                self.th, amount, row, self.ring[3], self.ring[2], self.ring[1], self.ring[0]
            )),
        );
        Some((self.ring, RingMovement::Row {
            th: self.th,
            amount: amount.abs(),
            outward: amount > 0,
        }))
    }
}

/// Calls the given callback for each ring movement.
/// This would use an iterator, but this ended up challenging as iterators cannot return
/// references to data they contain.
fn iterate_movements<F: Fn(RingMovement, Ring) -> Option<Solution>>(ring: Ring, cb: F) -> Option<Solution> {
    let mut rotators: ArrayVec<[RingRotations; NUM_RINGS as usize]> = (0..NUM_RINGS)
        .filter_map(|r| RingRotations::new(ring, r))
        .collect();
    let mut shifters: ArrayVec<[RingShifts; (NUM_ANGLES / 2) as usize]> = (0..(NUM_ANGLES / 2))
        .filter_map(|th| RingShifts::new(ring, th))
        .collect();
    for n in 0..NUM_ANGLES {
        for rotator in rotators.iter_mut() {
            let (moved, movement) = rotator.next().unwrap();
            if let Some(solution) = cb(movement, moved) {
                return Some(solution);
            }
        }
        if n < NUM_RINGS * 2 {
            for shifter in shifters.iter_mut() {
                let (moved, movement) = shifter.next().unwrap();
                if let Some(solution) = cb(movement, moved) {
                    return Some(solution);
                }
            }
        }
    }
    None
}

/// Perform the actual solve of RingData.
#[wasm_bindgen(skip_typescript)]
pub fn solve(ring: JsValue) -> Result<JsValue> {
    let ring: Ring = serde_wasm_bindgen::from_value(ring)?;
    let solution = find_solution(ring, MAX_TURNS);
    Ok(match solution {
        Some(solution) => serde_wasm_bindgen::to_value(&solution)?,
        None => JsValue::null(),
    })
}

/// Find a solution with the minimum number of turns,, given a max number of turns allowed.
/// This implements an IDDFS, useful for very wide, shallow trees like this solution space.
fn find_solution(ring: Ring, max_turns: u16) -> Option<Solution> {
    for turn in 0..=max_turns {
        if let Some(solution) = find_solution_at_turn(ring, turn) {
            return Some(solution);
        }
    }
    None
}

/// Finds a solution after a given number of turns.
fn find_solution_at_turn(ring: Ring, turn: u16) -> Option<Solution> {
    if turn == 0  {
        // Is the current ring a solution?
        return get_solution(ring);
    }
    // Go through each possible movement to determine if it leads to a solution.
    iterate_movements(ring, |movement, moved| {
        match find_solution_at_turn(moved, turn - 1) {
            Some(mut solution) => {
                solution.moves.push_front(movement);
                Some(solution)
            },
            None => None,
        }
    })
}

/// Gets a solution for the given ring, or None if the ring isn't a perfect solve.
fn get_solution(ring: Ring) -> Option<Solution> {
    // The number of enemies on the board.
    let enemies: u32 = ring.iter().copied().map(u16::count_ones).sum();

    // The enemies of the outer two rings, only accessible through jumps.
    // We merge the two outer rings because an enemy at any angle requires the whole angle.
    let outer = ring[2] | ring[3];

    // The enemies of the inner two rings that can be hit by hammers.
    // We merge the two inner rings and exclude those in outer, which must be hit with jumps.
    let mut inner = (ring[0] | ring [1]) & !outer;

    // Guarantee that the lowest bit in inner is a 0, or that all 12 angles have enemies.
    // This is done to avoid an extra simulated hammer if the inner rings look like e.g.:
    // 100000000001
    inner = Subring(inner).rotate_right(inner.trailing_ones() as u16).value();

    // The number of actions is ceil(enemies / 4).
    let actions = enemies / 4 + ((enemies % 4 != 0) as u32);

    // The number of jumps necessary for this ring.
    let jump_rows = outer.count_ones();

    // The number of groups that can be hammered.
    let mut hammerable_groups = 0;

    // Here, we simulate hammering the inner subrings by clearing bits next to each other.
    // For an inner subrings of 101110011110, it would take 5 hits:
    //
    // Hammer 1:
    // inner:  101110011110
    // hammer: 000000000110 (0b11 << 1)
    //
    // Hammer 2:
    // inner:  101110011000
    // hammer: 000000011000 (0b11 << 3)
    //
    // Hammer 3:
    // inner:  101110000000
    // hammer: 000110000000 (0b11 << 7)
    //
    // Hammer 4:
    // inner:  101000000000
    // hammer: 011000000000 (0b11 << 9)
    //
    // Hammer 5:
    // inner:  100000000000
    // hammer:1100000000000 (0b11 << 11)
    while inner != 0 {
        // Clears the enemies in the inner subrings with a single "hammer".
        inner &= !(0b11 << inner.trailing_zeros());
        hammerable_groups += 1;
    }
    if hammerable_groups + jump_rows > actions {
        // If it takes more hammers and jumps than we have actions available,
        // this isn't a solution.
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

/// This is like the `main` function, except for JavaScript.
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