import { Ring } from './ring';
import type { Solution } from './worker';
export type { Solution };
export declare class Solver {
    private worker_;
    private getWorker;
    solve(ring: Ring): Promise<Solution | null>;
}
