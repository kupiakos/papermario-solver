import type { RingMovement } from './movement';
export declare type RingData = [number, number, number, number];
export interface Solution {
    moves: RingMovement[];
    ring: RingData;
}
export interface SolverDone {
    type: 'done';
    solution: Solution | null;
}
interface SolverError {
    type: 'error';
    error: any;
}
export declare type SolverOutput = SolverDone | SolverError;
export declare type SolverWorker = Worker;
export default class WebpackWorker extends Worker {
    constructor();
}
export {};
