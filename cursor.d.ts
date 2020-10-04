import { RingPosition, Ring } from './ring';
import { MoveHistory } from './movement';
import { Controls } from './controls';
/**
 * A cursor for performing manual ring movements.
 * Currently only supports desktop keyboard movement.
 */
export declare class Cursor {
    pos: RingPosition;
    private type_;
    private state_;
    private currentMovement_;
    private animatingMovement_;
    private readonly animation_;
    private readonly ring_;
    private readonly moveHistory_;
    private readonly controls_;
    constructor(ring: Ring, moveHistory: MoveHistory, controls: Controls);
    /** Is this cursor currently hidden? */
    get hidden(): boolean;
    /** Is this cursor currently focused? */
    get focused(): boolean;
    /** Switches the type of the cursor between subring and row. */
    private switchType;
    /**
     * Has the cursor itself move - NOT move the underlying ring.
     * Precondition: !this.focused.
     * @param reverse If in row mode, move anticlockwise if this is true.
     * @param animate Whether to animate the cursor movement.
     */
    private move;
    /** Draws one animation frame. */
    private drawAnimationFrame;
    /** Draws the whole cursor. */
    draw(anim_amount?: number, ctx?: CanvasRenderingContext2D): void;
    /**
     * Draws a ring-shaped cursor.
     * @param anim_amount The animation amount, [0, 1]. Higher values are more outwards.
     * @param ctx The context to draw on.
     */
    private drawRing_;
    /**
     * Draws a row-shaped cursor.
     * @param anim_amount The animation amount, [-1, 1]. Higher values are more clockwise.
     * @param ctx The context to draw on.
     */
    private drawRow_;
    /** Hides the cursor and prevents it from being used. */
    hide(): void;
    /** Shows the cursor to let it be used. */
    show(): void;
    /** Can this cursor be interacted with by the user? */
    private isBusy;
    /** Manipulates the cursor with the keyboard. */
    onKeyDown(event: KeyboardEvent): void;
    /**
     * Confirms a planned movement with the cursor.
     * Precondition: this.focused.
     */
    private confirm;
    /**
     * Cancels or undoes, based on the focus state of the cursor.
     * Equivalent to pressing 'B' in the game.
     */
    cancel(): void;
    /**
     * Cancels a planned movement with the cursor.
     * Precondition: this.focused.
     */
    private cancelPlanned;
    /**
     * Undoes a movement already executed.
     * Precondition: !this.focused.
     */
    private undo;
    /**
     * Switches whether the cursor is focused or not.
     * Precondition: !this.hidden.
     */
    private switchFocus;
    /**
     * Updates the controls section with the relevant info.
     */
    private updateControls;
    /**
     * Moves the ring based on the current ring state.
     * Precondition: this.focused.
     * @param key The keypress string.
     */
    private moveRing;
    private arrowIsPositive;
}
