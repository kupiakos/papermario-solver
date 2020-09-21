import {simplifyMovement} from '../src/movement';
type Solver = typeof import('../pkg/solver');
let solver: Solver | null = null;

async function getSolver(): Promise<Solver> {
  if (solver === null) {
    solver = await import('../pkg/solver');
  }
  return solver;
}

export async function solve() {
  const solver = await getSolver();
  const solution = solver.solve([1, 3, 0, 1]);
  if (solution === null) {
    console.log('No solution found');
    return;
  }
  console.log({...solution, moves: solution.moves.map(simplifyMovement)});
}
