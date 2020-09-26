
import type {RingMovement} from './movement';

export type RingData = [number, number, number, number];
export interface Solution {
    moves: RingMovement[];
    ring: RingData;
}
interface SolverInput {
    ondone: MessagePort;
    ringData: RingData;
}
export interface SolverDone {
    type: 'done';
    solution: Solution | null;
}
interface SolverError {
    type: 'error';
    error: any;
}
export type SolverOutput = SolverDone | SolverError;
export type SolverWorker = Worker;
export default class WebpackWorker extends Worker {
  constructor() {
    super('');
  }
}

let solverModule: typeof import('../pkg/solver') | null = null;

self.addEventListener('message', async (e: MessageEvent<SolverInput>) => {
  if (solverModule === null) {
    solverModule = await import('../pkg/solver');
  }
  const ondone = e.data.ondone;
  try {
    const solution = solverModule.solve(e.data.ringData);
    ondone.postMessage({type: 'done', solution: solution});
  } catch (e) {
    ondone.postMessage({type: 'error', error: e});
  }
});
