import {simplifyMovement} from '../src/movement';
import {NUM_ANGLES, NUM_RINGS, Ring} from '../src/ring';
import type {RingData} from '../pkg/solver';
type Solver = typeof import('../pkg/solver');
let solver: Solver | null = null;

async function getSolver(): Promise<Solver> {
  if (solver === null) {
    solver = await import('../pkg/solver');
  }
  return solver;
}

function getRingData(ring: Ring): RingData {
  const ringData: RingData = [0, 0, 0, 0];
  for (let r = 0; r < NUM_RINGS; ++r) {
    let subring = 0;
    for (let th = 0; th < NUM_ANGLES; ++th) {
      subring |= (ring.getCell({th, r}).hasEnemy ? 1 : 0) << th;
    }
    ringData[r] = subring;
  }
  return ringData;
}

export async function solve(ring: Ring) {
  const solver = await getSolver();
  const solution = solver.solve(getRingData(ring));
  if (solution === null) {
    console.log('No solution found');
    return;
  }
  console.log({...solution, moves: solution.moves.map(simplifyMovement)});
}
