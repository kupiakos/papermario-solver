import { RingGroup, RingMovement } from './movement';
declare type Context = CanvasRenderingContext2D;
/**
 * To make drawing simpler, the canvases for drawing parts of the board are
 * done in layers. These are their names.
 * In order from top to bottom:
 *  - overlay: The inner and outer borders, hides a lot of visual artifacts.
 *  - enemy:   Where enemies are drawn.
 *  - cursor:  Where the cursor (only on desktop) is drawn.
 *  - ring:    Where the actual cells of the ring itself are drawn.
 */
declare type LayerName = 'overlay' | 'enemy' | 'cursor' | 'ring';
declare type Layers = {
    [name in LayerName]: Context;
};
declare type Canvases = {
    [name in LayerName]: HTMLCanvasElement;
};
interface Size {
    width: number;
    height: number;
}
/**
 * Specifies a unique position on the ring.
 * Equivalent to (x,y) for a 2D plane, but on a ring instead.
 */
export interface RingPosition {
    /**
     * The subring position, where 0 is the most inner subring.
     */
    r: number;
    /**
     * The angular position, where 0 is the rightmost angle and increases
     * clockwise. Short for theta/θ, used for angles.
     */
    th: number;
}
/**
 * The radius of the inner circle, i.e. the inner radius of the first subring.
 */
export declare const R0 = 60;
/**
 * The radial width of each cell/subring.
 */
export declare const CELL_WIDTH = 32;
/** The number of rings in the puzzle. */
export declare const NUM_RINGS = 4;
/** The number of different angles (i.e. "jumps") in the puzzle. */
export declare const NUM_ANGLES = 12;
/** The total number of cells, derived. */
export declare const NUM_CELLS: number;
/** The angle, in radians, each cell takes up. */
export declare const CELL_ANGLE: number;
export declare const OUTSIDE_WIDTH = 40;
/** The size of the logical container for the ring. */
export declare const FRAME: Size;
/** Different styles of animation for moving the ring. */
export declare enum AnimationMode {
    /** No animation will be done. */
    NONE = 0,
    /** Normal animation, for forwards movement. */
    NORMAL = 1,
    /** Fast animation, for quick undos. */
    UNDO = 2
}
/**
 * Draws a filled arc or "wedge", also the shape of each ring cell.
 * @param ctx The context to manipulate.
 * @param x The x position of the arc center.
 * @param y The y position of the arc center.
 * @param r1 The inner radius.
 * @param r2 The outer radius.
 * @param startAngle The starting angle of the wedge.
 * @param endAngle The ending angle of the wedge.
 * @param anticlockwise Whether to draw the arc anticlockwise.
 */
export declare function filledArc(ctx: Context, x: number, y: number, r1: number, r2: number, startAngle: number, endAngle: number, anticlockwise?: boolean): void;
/**
 * Stores the data necessary to draw and manipulate a single cell on a ring.
 * Notably, this doesn't contain the actual position of the cell. That's done
 * by the model itelf.
 */
declare class Cell {
    /** Does this cell currently contain an enemy? */
    hasEnemy: boolean;
    /** The fill style of the cell, used for drawing. */
    private readonly fill_;
    constructor(fill: string);
    /**
     * Draw the base of the cell, where the floor is.
     * @param ctx The context to draw on, expected to be the 'ring' layer.
     * @param pos The ring position to draw at. May be a non-integer.
     */
    drawBase(ctx: Context, pos: RingPosition): void;
    /**
     * Draw the top of the cell, where the enemies are.
     * @param ctx The context to draw on, expected to be the 'enemy' layer.
     * @param pos The ring position to draw at. May be a non-integer.
     */
    drawTop(ctx: Context, { th, r }: RingPosition): void;
    /**
     * Clear the top of the cell, where the enemies are.
     * @param ctx The context to draw on, expected to be the 'enemy' layer.
     * @param pos The ring position to clear.
     */
    clearTop(ctx: Context, pos: RingPosition): void;
    /** Paths out the actual base of the cell, for clearing or drawing. */
    private basePath;
}
/** A dumb class that draws cells in the ring. */
declare class RingView {
    private readonly layers_;
    private model_;
    /**
     * @param layers The set of Contexts to draw on.
     * @param model The {@link RingModel} that contains the cells.
     */
    constructor(layers: Layers, model: RingModel);
    /** Draw the whole ring, including the background. */
    draw(): void;
    /**
     * Draws a specific subring or row, possibly currently animated.
     * @param group The subring/row.
     * @param anim_amount The amount we're currently through an animation,
     * in the range [-1, 1]. See {@link drawSubring}, {@link drawAngle}.
     */
    drawGroup(group: RingGroup, anim_amount?: number): void;
    /** Get the cell at a given position. */
    private getCell;
    /**
     * Draws a specific subring, possibly currently animated.
     *
     * An anim_amount of 0 draws the subring as the model says.
     * Lower values are drawn rotated anticlockwise, and higher amounts are drawn
     * rotated clockwise.
     * @param r The radius index of the subring.
     * @param anim_amount The animation amount, in the range [-1, 1].
     */
    private drawSubring;
    /**
     * Draws a specific angle/half-row, possibly currently animated.
     *
     * An anim_amount of 0 draws the subring as the model says.
     * Lower values are drawn shifted inwards, and higher amounts are drawn
     * shifted outwards.
     * @param th The angular index (theta) of the subring.
     * @param anim_amount The animation amount, in the range [-1, 1].
     */
    private drawAngle;
    /** Draw the ring and its contents. */
    private drawRing;
    /** Draw the contents of the ring overlay. Should only need once. */
    private drawOverlay;
    /** Get the layer associated with the layer name. */
    getLayer(layer_name?: LayerName): Context;
}
/** Contains the actual data stored on the ring, with manipulation code. */
export declare class RingModel {
    /** The actual contents of the model, hidden through abstraction. */
    private readonly ringContents_;
    constructor();
    /**
     * Manipulate the ring contents, either a row shift or subring rotate.
     * @param m The ring movement to do.
     */
    move(m: RingMovement): void;
    /**
     * Rotate a subring once.
     * @param r The subring index to rotate.
     * @param clockwise Whether to rotate the ring clockwise.
     */
    private rotateRing;
    /**
     * Shift a given row once.
     * @param th The angular index to shift, [0, NUM_ANGLES).
     * @param outward Whether to shift outwards or inwards.
     */
    private shiftRow;
    getCell({ th, r }: RingPosition): Cell;
}
/**
 * Represents the user-visible ring and tools to manipulate it.
 * This is the really important class.
 */
export declare class Ring {
    private readonly canvases_;
    private readonly model_;
    private readonly view_;
    private currentMovement_;
    private readonly animation_;
    private readyCallbacks_;
    constructor(canvases: Canvases);
    get model(): RingModel;
    get view(): RingView;
    /**
     * Called on each frame of a move animation.
     * @param amount The progress through the animation to draw, [0, 1].
     */
    private onFrame;
    /** Executed when an animation has finished for a single movement. */
    private onSingleMoveDone;
    /** Is the ring currently busy being animated? */
    isBusy(): boolean;
    /** Returns a promise that resolves when the animation is done playing. */
    waitUntilReady(): Promise<void>;
    /** Animates a movement, returning a promise that resolves when it's done. */
    animateMove(m: RingMovement, animate?: AnimationMode): Promise<void>;
    /**
     * Draws a specific subring or row.
     * @param group The subring/row.
     */
    drawGroup(group: RingGroup): void;
    /**
     * Converts from a canvas offset to the equivalent in the drawing frame.
     * @param offsetPos.x The canvas.offsetX
     * @param offsetPos.y The canvas.offsetY
     * @returns The equivalent (X, Y) point in the frame, with a (0,0) center.
     */
    private offsetToFramePos;
    /**
     * Converts from a canvas offset to a ring position.
     * @param offsetPos.x The canvas.offsetX
     * @param offsetPos.y The canvas.offsetY
     * @returns The equivalent position in the ring, or null if there is none.
     */
    private offsetToRingPos;
    /** Run every time a mouse click or touch happens. */
    onMouseDown(event: MouseEvent): void;
}
export {};
