import { RingGroup, RingMovement } from './movement';
declare type Context = CanvasRenderingContext2D;
declare type LayerName = 'overlay' | 'enemy' | 'cursor' | 'ring';
declare type Canvases = {
    [name in LayerName]: HTMLCanvasElement;
};
interface Size {
    width: number;
    height: number;
}
interface Point {
    x: number;
    y: number;
}
export interface RingPosition {
    r: number;
    th: number;
}
export declare const R0 = 60;
export declare const CELL_WIDTH = 32;
export declare const NUM_RINGS = 4;
export declare const NUM_ANGLES = 12;
export declare const NUM_CELLS: number;
export declare const CELL_ANGLE: number;
export declare const OUTSIDE_WIDTH = 40;
export declare const FRAME: Size;
export declare enum AnimationMode {
    NONE = 0,
    NORMAL = 1,
    UNDO = 2
}
export declare function filledArc(ctx: Context, x: number, y: number, r1: number, r2: number, startAngle: number, endAngle: number, anticlockwise?: boolean): void;
declare class Cell {
    hasEnemy: boolean;
    private readonly fill_;
    constructor(fill: string);
    drawBase(ctx: Context, pos: RingPosition): void;
    drawTop(ctx: Context, { th, r }: RingPosition): void;
    clearTop(ctx: Context, pos: RingPosition): void;
    private basePath;
}
export declare class Ring {
    private readonly layers_;
    private readonly canvases_;
    private readonly ringContents;
    private readonly animation_;
    private currentMovement_;
    private readyCallbacks_;
    constructor(canvases: Canvases);
    private static isNegativeMovement;
    isBusy(): boolean;
    waitUntilReady(): Promise<void>;
    animateMove(m: RingMovement, animate?: AnimationMode): Promise<void>;
    move(m: RingMovement): void;
    private rotateRing;
    private shiftRow;
    getCell({ th, r }: RingPosition): Cell;
    draw(): void;
    getLayer(layer_name?: LayerName): Context;
    drawGroup(group: RingGroup, anim_amount?: number, both?: boolean): void;
    drawSubring(r: number, anim_amount?: number): void;
    drawRow(th: number, anim_amount?: number): void;
    drawRing(): void;
    drawBackground(): void;
    offsetToFramePos(offsetPos: Point): Point;
    offsetToRingPos(offsetPos: Point): RingPosition | null;
    onMouseDown(event: MouseEvent): void;
}
export {};
