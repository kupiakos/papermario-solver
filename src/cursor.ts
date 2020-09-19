import {
  combineMovements,
  reverseMovement,
  AnimationMode,
  RingGroupType,
  RingMovement,
  RingPosition,
  Ring,
  filledArc,
  R0,
  FRAME,
  NUM_RINGS,
  NUM_ANGLES,
  CELL_WIDTH,
  CELL_ANGLE,
} from './ring';
import {Animation} from './animation';

type CursorMode = RingGroupType;
type CursorMovement = {type: 'ring'} | {type: 'row'; clockwise: boolean};
const CURSOR_UNFOCUSED = 'rgba(186, 210, 247, 0.5)';
const CURSOR_FOCUSED = 'rgba(82, 148, 250, 0.8)';

const CURSOR_RING_MOVE_ANIMATION_TIME = 0.05;
const CURSOR_SHIFT_MOVE_ANIMATION_TIME = 0.1;

export class Cursor {
  type: CursorMode;
  pos: RingPosition;

  private focused_: boolean;
  private currentMovement_: RingMovement | null;
  private numMoves_: number;
  private animatingMovement_: CursorMovement | null;
  private readonly animation_: Animation;
  private readonly ring_: Ring;
  private readonly ringMovesDisplay_: HTMLElement;
  private readonly controlsDisplay_: HTMLElement;

  constructor(
    ring: Ring,
    ringMovesDisplay: HTMLElement,
    controlsDisplay: HTMLElement
  ) {
    this.type = 'ring';
    this.pos = {r: 0, th: 0};
    this.focused_ = false;
    this.ring_ = ring;
    this.animatingMovement_ = null;
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
    this.currentMovement_ = null;
    this.ringMovesDisplay_ = ringMovesDisplay;
    this.controlsDisplay_ = controlsDisplay;
    this.numMoves_ = 0;
  }

  get focused(): boolean {
    return this.focused_;
  }

  switchType() {
    if (this.type === 'ring') {
      this.type = 'row';
    } else if (this.type === 'row') {
      this.type = 'ring';
    }
  }

  sectionSelected(type: CursorMode, index: number) {
    if (this.type !== type) {
      return false;
    }
    if (this.type === 'ring') {
      return index === this.pos.r;
    }
    return index === this.pos.th;
  }

  cellSelected({th, r}: RingPosition) {
    if (this.type === 'ring') {
      return r === this.pos.r;
    }
    return th === this.pos.th;
  }

  move(reverse: boolean, animate = true) {
    if (animate) {
      if (this.animation_.isPlaying()) {
        return;
      }
      this.animatingMovement_ = {clockwise: reverse, type: this.type};
      this.animation_.play(
        this.type === 'ring'
          ? CURSOR_RING_MOVE_ANIMATION_TIME
          : CURSOR_SHIFT_MOVE_ANIMATION_TIME
      );
      return;
    }
    if (this.type === 'ring') {
      this.pos = {...this.pos, r: (this.pos.r + 1) % NUM_RINGS};
    } else {
      const d = reverse ? 1 : -1;
      this.pos = {
        ...this.pos,
        th: (this.pos.th + d + NUM_ANGLES) % (NUM_ANGLES / 2),
      };
    }
  }

  private drawAnimationFrame(amount: number) {
    if (!this.animatingMovement_) {
      throw new ReferenceError('Last movement null?');
    }
    if (
      this.animatingMovement_.type === 'row' &&
      this.animatingMovement_.clockwise
    ) {
      amount = -amount;
    }
    this.draw(amount);
  }

  draw(
    anim_amount = 0,
    ctx: CanvasRenderingContext2D = this.ring_.getLayer('cursor')
  ) {
    ctx.clearRect(
      -FRAME.width / 2,
      -FRAME.height / 2,
      FRAME.width * 1.5,
      FRAME.height * 1.5
    );
    ctx.fillStyle = this.focused ? CURSOR_FOCUSED : CURSOR_UNFOCUSED;
    if (this.type === 'ring') {
      this.drawRing_(anim_amount, ctx);
    } else if (this.type === 'row') {
      this.drawRow_(anim_amount, ctx);
    }
  }

  private drawRing_(anim_amount: number, ctx: CanvasRenderingContext2D) {
    let r = this.pos.r + anim_amount;
    ctx.moveTo(0, 0);
    ctx.beginPath();
    const boardR = R0 + r * CELL_WIDTH;
    filledArc(ctx, 0, 0, boardR, boardR + CELL_WIDTH, 0, Math.PI * 2);
    ctx.fill();
    if (r > NUM_RINGS - 1 || r < 0) {
      r = (r + NUM_RINGS) % NUM_RINGS;
      const boardR = R0 + r * CELL_WIDTH;
      ctx.moveTo(0, 0);
      ctx.beginPath();
      filledArc(ctx, 0, 0, boardR, boardR + CELL_WIDTH, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRow_(anim_amount: number, ctx: CanvasRenderingContext2D) {
    const th = this.pos.th;
    ctx.moveTo(0, 0);
    ctx.beginPath();
    for (const drawTh of [th, (th + NUM_ANGLES / 2) % NUM_ANGLES]) {
      const boardTh = (drawTh - anim_amount) * CELL_ANGLE;
      const endR = R0 + CELL_WIDTH * NUM_RINGS;
      filledArc(ctx, 0, 0, R0, endR, boardTh, boardTh + CELL_ANGLE);
      ctx.moveTo(0, 0);
    }
    ctx.fill();
  }

  // Manipulate the cursor with the keyboard.
  onKeyDown(event: KeyboardEvent) {
    if (this.ring_.isBusy()) {
      return;
    }
    if (event.key === 'Enter' && !this.focused) {
      this.currentMovement_ = null;
      this.switchType();
      this.draw();
    } else if (event.key === ' ') {
      if (this.focused) {
        this.numMoves_++;
        this.ringMovesDisplay_.innerText = '×' + this.numMoves_;
      }
      this.switchFocus();
      this.currentMovement_ = null;
    } else if (event.key === 'Backspace' || event.key === 'Escape') {
      if (this.focused) {
        this.cancel();
      }
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

  // Precondition: this.focused.
  private cancel() {
    if (this.currentMovement_ === null) {
      this.switchFocus();
      // We haven't moved in this focus yet, nothing to undo.
      return;
    }
    const movement = reverseMovement(this.currentMovement_);
    this.ring_.move(movement, AnimationMode.UNDO);
    this.ring_.drawGroup(movement);
    this.ring_.onReady(() => this.switchFocus());
    this.currentMovement_ = null;
  }

  private switchFocus() {
    this.focused_ = !this.focused_;
    this.draw();
    this.controlsDisplay_.setAttribute(
      'state',
      this.focused ? 'moving' : 'choosing'
    );
  }

  // Precondition: this.focused
  private moveRing(key: string) {
    let positive = this.arrowIsPositive(key);
    if (positive === null) {
      return;
    }
    let movement: RingMovement;
    if (this.type === 'ring') {
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
      const quadrant1Or3 = th % (NUM_ANGLES / 2) >= NUM_ANGLES / 4;
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
    this.currentMovement_ = combineMovements(this.currentMovement_, movement);
    this.ring_.move(movement, AnimationMode.NORMAL);
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
