import type {SolverInput} from '../pkg/solver';
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
