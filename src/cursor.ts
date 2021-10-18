import {
  AnimationMode,
  RingPosition,
  Ring,
  filledArc,
  ArcStyle,
  Size,
} from './ring';
import {
  combineMovements,
  MoveHistory,
  reverseMovement,
  RingGroupType,
  RingMovement,
} from './movement';
import {Animation} from './animation';
import {Controls, ControlState} from './controls';
import {RingSettings} from './ring_settings';

type CursorType = RingGroupType;
type CursorMovement = {type: 'ring'} | {type: 'row'; clockwise: boolean};
const CURSOR_UNFOCUSED = 'rgba(186, 210, 247, 0.5)';
const CURSOR_FOCUSED = 'rgba(82, 148, 250, 0.8)';

const CURSOR_RING_MOVE_ANIMATION_TIME = 0.05;
const CURSOR_SHIFT_MOVE_ANIMATION_TIME = 0.1;

enum CursorState {
  /** The cursor is unfocused. Movement moves the cursor. */
  UNFOCUSED = 0,
  /** The cursor is focused. Movement moves the ring. */
  FOCUSED = 1,
  /** The cursor is hidden. Movement does nothing. */
  HIDDEN = 2,
}

type CursorStyle = {cell: ArcStyle; frame: Size};

/**
 * A cursor for performing manual ring movements.
 * Currently only supports desktop keyboard movement.
 */
export class Cursor {
  pos: RingPosition = {r: 0, th: 0};

  private type_: CursorType = 'ring';
  private state_: CursorState = CursorState.UNFOCUSED;
  private currentMovement_: RingMovement | null = null;
  private animatingMovement_: CursorMovement | null = null;
  private readonly animation_: Animation;
  private readonly ring_: Ring;
  private readonly moveHistory_: MoveHistory;
  private readonly controls_: Controls;
  private readonly ring_settings: RingSettings;
  private readonly style: CursorStyle;

  constructor(
    ring: Ring,
    moveHistory: MoveHistory,
    controls: Controls,
    style: CursorStyle,
    ring_settings: RingSettings
  ) {
    this.ring_ = ring;
    this.ring_settings = ring_settings;
    this.style = style;
    this.animation_ = new Animation(
      CURSOR_RING_MOVE_ANIMATION_TIME,
      amount => this.drawAnimationFrame(amount),
      () => {
        if (!this.animatingMovement_) {
          throw new ReferenceError('Last movement undefined?');
        }
        const clockwise =
          this.animatingMovement_.type === 'ring' ||
          this.animatingMovement_.clockwise;
        this.move(clockwise, false);
        this.draw();
      }
    );
    this.moveHistory_ = moveHistory;
    this.controls_ = controls;
  }

  /** Is this cursor currently hidden? */
  get hidden(): boolean {
    return this.state_ === CursorState.HIDDEN;
  }

  /** Is this cursor currently focused? */
  get focused(): boolean {
    return this.state_ === CursorState.FOCUSED;
  }

  /** Switches the type of the cursor between subring and row. */
  private switchType() {
    if (this.type_ === 'ring') {
      this.type_ = 'row';
    } else if (this.type_ === 'row') {
      this.type_ = 'ring';
    }
  }

  /**
   * Has the cursor itself move - NOT move the underlying ring.
   * Precondition: !this.focused.
   * @param reverse If in row mode, move anticlockwise if this is true.
   * @param animate Whether to animate the cursor movement.
   */
  private move(reverse: boolean, animate = true) {
    if (animate) {
      if (this.animation_.isPlaying()) {
        return;
      }
      this.animatingMovement_ = {clockwise: reverse, type: this.type_};
      this.animation_.play(
        this.type_ === 'ring'
          ? CURSOR_RING_MOVE_ANIMATION_TIME
          : CURSOR_SHIFT_MOVE_ANIMATION_TIME
      );
      return;
    }
    if (this.type_ === 'ring') {
      this.pos = {
        ...this.pos,
        r: (this.pos.r + 1) % this.ring_settings.num_rings,
      };
    } else {
      const d = reverse ? 1 : -1;
      this.pos = {
        ...this.pos,
        th:
          (this.pos.th + d + this.ring_settings.num_angles) %
          (this.ring_settings.num_angles / 2),
      };
    }
  }

  /** Draws one animation frame. */
  private drawAnimationFrame(amount: number) {
    if (!this.animatingMovement_) {
      throw new ReferenceError('Last movement null?');
    }
    if (
      this.animatingMovement_.type === 'row' &&
      !this.animatingMovement_.clockwise
    ) {
      amount = -amount;
    }
    this.draw(amount);
  }

  /** Draws the whole cursor. */
  draw(
    anim_amount = 0,
    ctx: CanvasRenderingContext2D = this.ring_.view.getLayer('cursor')
  ) {
    const frame = this.style.frame;
    ctx.clearRect(
      -frame.width / 2,
      -frame.height / 2,
      frame.width * 1.5,
      frame.height * 1.5
    );
    if (this.hidden) {
      return;
    }
    ctx.fillStyle = this.focused ? CURSOR_FOCUSED : CURSOR_UNFOCUSED;
    if (this.type_ === 'ring') {
      this.drawRing_(anim_amount, ctx);
    } else if (this.type_ === 'row') {
      this.drawRow_(anim_amount, ctx);
    }
  }

  /**
   * Draws a ring-shaped cursor.
   * @param anim_amount The animation amount, [0, 1]. Higher values are more outwards.
   * @param ctx The context to draw on.
   */
  private drawRing_(anim_amount: number, ctx: CanvasRenderingContext2D) {
    let r = this.pos.r + anim_amount;
    ctx.moveTo(0, 0);
    ctx.beginPath();
    const boardR = this.style.cell.r0 + r * this.style.cell.width;
    filledArc(
      ctx,
      0,
      0,
      boardR,
      boardR + this.style.cell.width,
      0,
      Math.PI * 2
    );
    ctx.fill();
    if (r > this.ring_settings.num_rings - 1 || r < 0) {
      r = (r + this.ring_settings.num_rings) % this.ring_settings.num_rings;
      const boardR = this.style.cell.r0 + r * this.style.cell.width;
      ctx.moveTo(0, 0);
      ctx.beginPath();
      filledArc(
        ctx,
        0,
        0,
        boardR,
        boardR + this.style.cell.width,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  /**
   * Draws a row-shaped cursor.
   * @param anim_amount The animation amount, [-1, 1]. Higher values are more clockwise.
   * @param ctx The context to draw on.
   */
  private drawRow_(anim_amount: number, ctx: CanvasRenderingContext2D) {
    const th = this.pos.th;
    ctx.moveTo(0, 0);
    ctx.beginPath();
    for (const drawTh of [
      th,
      (th + this.ring_settings.num_angles / 2) % this.ring_settings.num_angles,
    ]) {
      const boardTh =
        (drawTh - anim_amount) * (this.style.cell.angle ?? Math.PI * 2);
      const endR =
        this.style.cell.r0 +
        this.style.cell.width * this.ring_settings.num_rings;
      filledArc(
        ctx,
        0,
        0,
        this.style.cell.r0,
        endR,
        boardTh,
        boardTh + (this.style.cell.angle ?? Math.PI * 2)
      );
      ctx.moveTo(0, 0);
    }
    ctx.fill();
  }

  /** Hides the cursor and prevents it from being used. */
  hide() {
    if (this.hidden) {
      return;
    }
    if (this.focused) {
      this.confirm();
    }
    if (this.state_ !== CursorState.UNFOCUSED) {
      throw new Error('BUG: Cursor state not unfocused');
    }
    this.state_ = CursorState.HIDDEN;
    this.draw();
    this.updateControls();
  }

  /** Shows the cursor to let it be used. */
  show() {
    if (this.hidden) {
      this.state_ = CursorState.UNFOCUSED;
    }
    this.draw();
    this.updateControls();
  }

  /** Can this cursor be interacted with by the user? */
  private isBusy(): boolean {
    return this.ring_.isBusy() || this.hidden;
  }

  /** Manipulates the cursor with the keyboard. */
  onKeyDown(event: KeyboardEvent) {
    if (this.isBusy()) {
      return;
    }
    if (event.key === 'Enter' && !this.focused) {
      this.currentMovement_ = null;
      this.switchType();
      this.draw();
    } else if (event.key === ' ') {
      if (this.focused) {
        this.confirm();
      } else {
        this.switchFocus();
      }
    } else if (event.key === 'Backspace' || event.key === 'Escape') {
      this.cancel();
    } else {
      if (this.focused) {
        this.moveRing(event.key);
      } else {
        const positive = this.arrowIsPositive(event.key);
        if (positive === null) {
          return;
        }
        this.move(positive);
        this.draw();
      }
    }
  }

  /**
   * Confirms a planned movement with the cursor.
   * Precondition: this.focused.
   */
  private confirm() {
    this.moveHistory_.addMovement(this.currentMovement_);
    this.switchFocus();
  }

  /**
   * Cancels or undoes, based on the focus state of the cursor.
   * Equivalent to pressing 'B' in the game.
   */
  cancel() {
    if (this.isBusy()) {
      return;
    }
    if (this.focused) {
      this.cancelPlanned();
    } else {
      this.undo();
    }
  }

  /**
   * Cancels a planned movement with the cursor.
   * Precondition: this.focused.
   */
  private cancelPlanned() {
    if (this.currentMovement_ === null) {
      this.switchFocus();
      // We haven't moved in this focus yet, nothing to undo.
      return;
    }
    const movement = reverseMovement(this.currentMovement_);
    this.ring_
      .animateMove(movement, AnimationMode.UNDO)
      .then(() => this.switchFocus());
    this.ring_.drawGroup(movement);
    this.currentMovement_ = null;
    this.updateControls();
  }

  /**
   * Undoes a movement already executed.
   * Precondition: !this.focused.
   */
  private undo() {
    if (this.moveHistory_.empty) {
      return;
    }
    const movement = this.moveHistory_.popMovement();
    if (movement === null) {
      return;
    }
    this.ring_.animateMove(reverseMovement(movement), AnimationMode.UNDO);
    this.ring_.drawGroup(movement);
    this.updateControls();
  }

  /**
   * Switches whether the cursor is focused or not.
   * Precondition: !this.hidden.
   */
  private switchFocus() {
    if (this.hidden) {
      return;
    }
    this.state_ = this.focused ? CursorState.UNFOCUSED : CursorState.FOCUSED;
    this.currentMovement_ = null;
    this.draw();
    this.updateControls();
  }

  /**
   * Updates the controls section with the relevant info.
   */
  private updateControls() {
    const states: ControlState[] = [];
    if (this.focused) {
      states.push('moving');
    } else {
      states.push('choosing');
      if (!this.moveHistory_.empty) {
        states.push('undo');
      }
    }
    if (this.hidden) {
      states.push('hidden');
    }
    this.controls_.setStates(states);
  }

  /**
   * Moves the ring based on the current ring state.
   * Precondition: this.focused.
   * @param key The keypress string.
   */
  private moveRing(key: string) {
    let positive = this.arrowIsPositive(key);
    if (positive === null) {
      return;
    }
    let movement: RingMovement;
    if (this.type_ === 'ring') {
      movement = {
        type: 'ring',
        clockwise: positive,
        r: this.pos.r,
        amount: 1,
      };
    } else {
      const th = this.pos.th;
      // While actively shifting, the direction depends where you are.
      // On the bottom-left/top-right rows, Up = Right, Down = Left.
      const quadrant1Or3 =
        th % (this.ring_settings.num_angles / 2) >=
        this.ring_settings.num_angles / 4;
      if (quadrant1Or3 && (key === 'ArrowLeft' || key === 'ArrowRight')) {
        positive = !positive;
      }
      movement = {
        type: 'row',
        outward: positive,
        th,
        amount: 1,
      };
    }
    this.currentMovement_ = combineMovements(
      this.currentMovement_,
      movement,
      this.ring_settings
    );
    this.ring_.animateMove(movement, AnimationMode.NORMAL);
    this.ring_.drawGroup(movement);
  }

  // When moving, Up = Left, Down = Right.
  // Left = counter-clockwise, right = clockwise.
  private arrowIsPositive(key: string): boolean | null {
    if (key === 'ArrowUp' || key === 'ArrowLeft') {
      return false;
    } else if (key === 'ArrowDown' || key === 'ArrowRight') {
      return true;
    } else {
      return null;
    }
  }
}
