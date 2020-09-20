type Solver = typeof import('../pkg/solver');
let solver: Solver | null = null;

async function getSolver(): Promise<Solver> {
  if (solver === null) {
    solver = await import('../pkg/solver');
  }
  return solver;
}

export async function test() {
  (await getSolver()).test();
}
