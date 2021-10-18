import {simplifyMovement} from './movement';
import {RingModel} from './ring';
import {RingSettings} from './ring_settings';
import type {RingData, Solution, SolverOutput} from './worker';
export type {Solution};

export class Solver {
  private worker_: Worker | null = null;
  private ring_settings: RingSettings;

  constructor(ring_settings: RingSettings) {
    this.ring_settings = ring_settings;
  }

  /** Return or build a solver worker. */
  private async getWorker(): Promise<Worker> {
    if (this.worker_ === null) {
      const w = new Worker('./worker.js');
      w.onmessage = w.onerror = w.onmessageerror = console.error;
      this.worker_ = w;
    }
    return this.worker_;
  }

  /**
   * Solve a ring puzzle asynchronously.
   * @param ring The ring data to find a solution for.
   * @returns A promise that resolves with a found solution, or null if none found.
   */
  async solve(ring: RingModel): Promise<Solution | null> {
    const worker = await this.getWorker();
    const channel = new MessageChannel();
    worker.postMessage(
      {ondone: channel.port2, ringData: this.getRingData(ring)},
      [channel.port2]
    );
    return new Promise((resolve, reject) => {
      channel.port1.onmessage = (e: MessageEvent<SolverOutput>) => {
        if (e.data.type === 'done') {
          const s = e.data.solution;
          if (s === null) {
            resolve(null);
          } else {
            resolve({
              ...s,
              moves: s.moves.map(m => simplifyMovement(m, this.ring_settings)),
            });
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

  getRingData(ring: RingModel): RingData {
    const ringData: RingData = [0, 0, 0, 0];
    for (let r = 0; r < this.ring_settings.num_rings; ++r) {
      let subring = 0;
      for (let th = 0; th < this.ring_settings.num_angles; ++th) {
        subring |= (ring.getCell({th, r}).hasEnemy ? 1 : 0) << th;
      }
      ringData[r] = subring;
    }
    return ringData;
  }
}
