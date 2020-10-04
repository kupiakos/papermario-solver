import { RingModel } from './ring';
import type { Solution } from './worker';
export type { Solution };
export declare class Solver {
    private worker_;
    /** Return or build a solver worker. */
    private getWorker;
    /**
     * Solve a ring puzzle asynchronously.
     * @param ring The ring data to find a solution for.
     * @returns A promise that resolves with a found solution, or null if none found.
     */
    solve(ring: RingModel): Promise<Solution | null>;
}
