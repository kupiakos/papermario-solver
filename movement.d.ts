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
export declare function simplifyMovement(m: RingMovement): RingMovement;
export declare function combineMovements(m1: RingMovement | null, m2: RingMovement): RingMovement | null;
export declare function reverseMovement(m: RingMovement): RingMovement;
export declare class MoveHistory {
    private moves_;
    private readonly ringMovesDisplay_;
    constructor(ringMovesDisplay: HTMLElement);
    addMovement(m: RingMovement | null): void;
    get empty(): boolean;
    popMovement(): RingMovement | null;
    private updateDisplay;
}
