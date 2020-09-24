import {simplifyMovement} from '../src/movement';
import {NUM_ANGLES, NUM_RINGS, Ring} from '../src/ring';
import type {RingData, Solution, SolverOutput} from '../pkg/solver';
// import {solve} from 'worker-loader!../pkg/solver.js';
// import type {solve} from '../pkg/solver';

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
    // const workerConstructor = await ((import(
    //   './worker'
    //   // 'worker-loader!../pkg/solver'
    // ) as unknown) as Promise<typeof Worker>);
    if (this.worker_ === null) {
      const w = new Worker('./worker.js');
      w.onmessage = w.onerror = w.onmessageerror = console.error;
      this.worker_ = w;
      // eslint-disable-next-line node/no-unpublished-require
      // this.worker_ = new workerConstructor('');
    }
    return this.worker_;
  }

  async solve(ring: Ring): Promise<Solution | null> {
    const worker = await this.getWorker();
    const channel = new MessageChannel();
    worker.postMessage({ondone: channel.port2, ringData: getRingData(ring)}, [
      channel.port2,
    ]);
    return new Promise((resolve, reject) => {
      channel.port1.onmessage = (e: SolverOutput) => {
        if (e.data.type === 'done') {
          const s = e.data.solution;
          if (s === null) {
            resolve(null);
          } else {
            resolve({...s, moves: s.moves.map(simplifyMovement)});
          }
        } else {
          reject(e.data.error);
        }
      };
      channel.port1.onmessageerror = e => {
        reject(e.data);
      };
    });
  }
}
