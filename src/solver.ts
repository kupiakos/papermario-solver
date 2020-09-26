import {simplifyMovement} from '../src/movement';
import {NUM_ANGLES, NUM_RINGS, Ring} from '../src/ring';
import type {RingData, Solution, SolverError, SolverOutput} from './worker';
export type {SolverOutput, Solution};

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

export class Solver {
  private worker_: Worker | null = null;

  private async getWorker(): Promise<Worker> {
    if (this.worker_ === null) {
      const w = new Worker('./worker.js');
      w.onmessage = w.onerror = w.onmessageerror = console.error;
      this.worker_ = w;
    }
    return this.worker_;
  }

  async solve(ring: Ring): Promise<SolverOutput> {
    const worker = await this.getWorker();
    const channel = new MessageChannel();
    worker.postMessage({ondone: channel.port2, ringData: getRingData(ring)}, [
      channel.port2,
    ]);
    return new Promise((resolve, reject) => {
      channel.port1.onmessage = (
        e: MessageEvent<SolverOutput | SolverError>
      ) => {
        if (e.data.type === 'error') {
          reject(e.data.error);
          return;
        }
        if (e.data.type === 'found') {
          const s = e.data.solution;
          s.moves = s.moves.map(simplifyMovement);
        }
        resolve(e.data);
      };
      channel.port1.onmessageerror = e => {
        reject(e.data);
      };
    });
  }
}
