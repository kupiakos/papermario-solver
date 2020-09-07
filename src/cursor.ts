import {
  RingPosition, Wheel, filledArc,
  R0, CENTER, FRAME,
  NUM_RINGS, NUM_ANGLES,
  CELL_WIDTH, CELL_ANGLE} from './wheel';
import { Animation } from './animation'

type CursorMode = 'ring' | 'row';
const CURSOR_UNFOCUSED = 'rgba(186, 210, 247, 0.5)';
const CURSOR_FOCUSED = 'rgba(82, 148, 250, 0.8)';

const CURSOR_RING_MOVE_ANIMATION_TIME = 0.05;
const CURSOR_SHIFT_MOVE_ANIMATION_TIME = 0.1;

export class Cursor {
  type: CursorMode;
  pos: RingPosition;
  focused: boolean;

  private animation?: Animation;
  private readonly wheel: Wheel;

  constructor(wheel: Wheel) {
    this.type = 'ring';
    this.pos = {r: 0, th: 0};
    this.focused = false;
    this.wheel = wheel;
  }

  switchType() {
    if (this.type === 'ring') {
      this.type = 'row';
    } else if (this.type === 'row') {
      this.type = 'ring';
    }
  }

  sectionSelected(type: CursorMode, index: number) {
    if (this.type !== type) { return false; }
    if (this.type === 'ring') {
      return index === this.pos.r;
    } else if (this.type === 'row') {
      return index === this.pos.th;
    }
  }

  cellSelected({th, r}: RingPosition) {
    if (this.type === 'ring') {
      return r === this.pos.r;
    } else if (this.type === 'row') {
      return th === this.pos.th;
    }
  }

  move(reverse: boolean, animate: boolean = true) {
    if (animate) {
      if (this.animation && this.animation.isPlaying()) { return; }
      this.animation = new Animation(
        this.type === 'ring' ?
        CURSOR_RING_MOVE_ANIMATION_TIME :
        CURSOR_SHIFT_MOVE_ANIMATION_TIME,
        amount => {
          amount = amount;
          if (this.type === 'row' && reverse) { amount = -amount; }
          this.draw(amount);
        }, () => {
          this.move(reverse, false);
          this.draw();
        });
      this.animation.play();
      return;
    }
    if (this.type === 'ring') {
      this.pos = {...this.pos, r: (this.pos.r + 1) % NUM_RINGS};
    } else {
      let d = reverse ? 1 : -1;
      this.pos = {...this.pos,
        th: (this.pos.th + d + NUM_ANGLES) % (NUM_ANGLES / 2)};
    }
  }

  draw(anim_amount: number = 0,
      ctx: CanvasRenderingContext2D = this.wheel.getLayer('cursor')) {
    // console.log('draw cursor', anim_amount);
    ctx.clearRect(0, 0, FRAME.width, FRAME.height);
    ctx.fillStyle = this.focused ? CURSOR_FOCUSED : CURSOR_UNFOCUSED;
    if (this.type === 'ring') {
      let r = this.pos.r + anim_amount;
      ctx.moveTo(CENTER.x, CENTER.y);
      ctx.beginPath();
      filledArc(ctx,
        CENTER.x, CENTER.y,
        R0 + (r)*CELL_WIDTH,
        R0 + (r+1)*CELL_WIDTH,
        0, Math.PI * 2);
      ctx.fill();
      if (r + 1 >= NUM_RINGS) {
        r -= NUM_RINGS;
        // Note: only supports "forward" movement.
        ctx.moveTo(CENTER.x, CENTER.y);
        ctx.beginPath();
        filledArc(ctx,
          CENTER.x, CENTER.y,
          R0 + (r)*CELL_WIDTH,
          R0 + (r+1)*CELL_WIDTH,
          0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.type === 'row') {
      let th = this.pos.th;
      ctx.moveTo(CENTER.x, CENTER.y);
      ctx.beginPath();
      filledArc(ctx, CENTER.x, CENTER.y, R0, R0 + CELL_WIDTH*NUM_RINGS,
        (th-anim_amount)*CELL_ANGLE, (th+1-anim_amount)*CELL_ANGLE);
      ctx.moveTo(CENTER.x, CENTER.y);
      th = (th + NUM_ANGLES / 2) % NUM_ANGLES;
      filledArc(ctx, CENTER.x, CENTER.y, R0, R0 + CELL_WIDTH*NUM_RINGS,
        (th-anim_amount)*CELL_ANGLE, (th+1-anim_amount)*CELL_ANGLE);
      ctx.fill();
    }
  }

  // Manipulate the cursor with the keyboard.
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !this.focused) {
      this.switchType();
      this.draw();
    } else if (event.key === ' ') {
      this.focused = !this.focused;
      this.draw();
    } else {
      let reverse: boolean;
      // When moving, Up = Left, Down = Right.
      // Left = counter-clockwise, right = clockwise.
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        reverse = false;
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        reverse = true;
      } else {
        return;
      }
      if (this.focused) {
        if (this.type === 'ring') {
          let r = this.pos.r;
          this.wheel.rotateRing(r, reverse);
          this.wheel.drawRing(r);
        } else {
          let th = this.pos.th;
          // While actively shifting, the direction depends where you are.
          // On the bottom-left/top-right rows, Up = Right, Down = Left.
          if (th % (NUM_ANGLES / 2) >= NUM_ANGLES / 4 &&
            (event.key === 'ArrowLeft' ||
              event.key === 'ArrowRight')) {
            reverse = !reverse;
          }
          this.wheel.shiftRow(th, reverse);
          this.wheel.drawRow(th);
          this.wheel.drawRow((th + NUM_ANGLES / 2) % NUM_ANGLES);
        }
      } else {
        this.move(reverse);
        this.draw();
      }
    }
  }
}
