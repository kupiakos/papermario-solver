export declare type RingSubring = {
    type: 'ring';
    r: number;
};
export declare type RingRow = {
    type: 'row';
    th: number;
};
export declare type RingGroupType = 'ring' | 'row';
export declare type RingGroup = RingSubring | RingRow;
export declare type RingRotate = RingSubring & {
    clockwise: boolean;
    amount: number;
};
export declare type RingShift = RingRow & {
    outward: boolean;
    amount: number;
};
export declare type RingMovement = RingRotate | RingShift;
/**
 * Simplifies a movement, reducing it to its quickest form.
 * @param m The movement to simplify.
 */
export declare function simplifyMovement(m: RingMovement): RingMovement;
/**
 * Combine two movements of the same type.
 * @param m1 The first movement, or null if none.
 * @param m2 The second movement.
 * @returns The combined movement, or null if no movement.
 * @throws If the movements are not of the same type.
 */
export declare function combineMovements(m1: RingMovement | null, m2: RingMovement): RingMovement | null;
/**
 * Reverses a movement.
 * combineMovements(m, reverseMovement(m)) === null for every m.
 * @param m The movement to reverse.
 */
export declare function reverseMovement(m: RingMovement): RingMovement;
/**
 * Returns whether the movement is considered "negative" for the
 * purposes of animation.
 */
export declare function isNegativeMovement(m: RingMovement): boolean;
/**
 * Keeps track of multiple movements and move history for a ring.
 */
export declare class MoveHistory {
    private moves_;
    private readonly ringMovesDisplay_;
    constructor(ringMovesDisplay: HTMLElement);
    addMovement(m: RingMovement | null): void;
    get empty(): boolean;
    popMovement(): RingMovement | null;
    private updateDisplay;
}
