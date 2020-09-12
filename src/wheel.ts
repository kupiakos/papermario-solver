import { Animation } from './animation';

type Context = CanvasRenderingContext2D;
type LayerName = 'overlay' | 'enemy' | 'cursor' | 'wheel';

type Layers = {
  [name in LayerName]: Context;
};

type Canvases = {
  [name in LayerName]: HTMLCanvasElement;
}

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

export type RingSubring = { type: 'ring', r: number };
export type RingRow = { type: 'row', th: number };
export type RingGroupType = 'ring' | 'row';
export type RingGroup = RingSubring | RingRow;

export type RingRotate = RingSubring & { clockwise: boolean };
export type RingShift = RingRow & { outward: boolean };
export type RingMovement = RingRotate | RingShift;

export const R0 = 77;
export const CELL_WIDTH = 32;

export const NUM_RINGS = 4;
export const NUM_ANGLES = 12;
export const NUM_CELLS = NUM_RINGS * NUM_ANGLES;
export const CELL_ANGLE = 2*Math.PI / NUM_ANGLES;
export const OUTSIDE_WIDTH = 45;

export const FRAME: Size = {
  width: (R0 + NUM_RINGS * CELL_WIDTH + OUTSIDE_WIDTH) * 2,
  height: (R0 + NUM_RINGS * CELL_WIDTH + OUTSIDE_WIDTH) * 2,
};

const RING_ROTATE_ANIMATION_TIME = 0.15;
const RING_SHIFT_ANIMATION_TIME = 0.3;

const CELL1_FILL = '#ada786';
const CELL2_FILL = '#8f8a6d';
const CELL_BORDER = 'black';
const CELL_BORDER_WIDTH = 0.8;

const INSIDE_BORDER = '#bf7e56';
const INSIDE_FILL = '#a64250';
const INSIDE_BORDER_WIDTH = 6;

const OUTSIDE_FILL = '#5AE67C';
const OUTSIDE_BORDER = '#99851A';
const OUTSIDE_BORDER_WIDTH = 6;

const ENEMY_COLOR = '#ee0';
const ENEMY_RADIUS = 9;

const DRAW_CELL_NUMBERS = false;

function cellCenter({th, r}: RingPosition) {
  return {
      x: (R0 + (r+0.5) * CELL_WIDTH) * Math.cos((th+.5) * CELL_ANGLE),
      y: (R0 + (r+0.5) * CELL_WIDTH) * Math.sin((th+.5) * CELL_ANGLE),
  };
}

// https://stackoverflow.com/a/45125187
function innerStroke(ctx: Context) {
  ctx.save();
  ctx.clip();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function filledArc(ctx: Context,
    x: number, y: number,
    r1: number, r2: number,
    startAngle: number, endAngle: number,
    anticlockwise: boolean = false) {
  ctx.arc(x, y, r1, startAngle, endAngle, anticlockwise);
  ctx.arc(x, y, r2, endAngle, startAngle, !anticlockwise);
  ctx.closePath();
}

class Cell {
  readonly fill: string;
  has_enemy: boolean;

  constructor(fill: string) {
    this.fill = fill;
    this.has_enemy = false;
  }

  drawBase(ctx: Context, {th, r}: RingPosition) {
    ctx.strokeStyle = CELL_BORDER;
    ctx.fillStyle = this.fill;
    ctx.lineWidth = CELL_BORDER_WIDTH;
    ctx.moveTo(0, 0);
    ctx.beginPath();
    filledArc(ctx,
      0, 0,
      R0 + r * CELL_WIDTH, R0 + (r+1) * CELL_WIDTH,
      th*CELL_ANGLE, (th+1)*CELL_ANGLE);
    innerStroke(ctx);
  }

  drawTop(ctx: Context, {th, r}: RingPosition) {
    let dot_center = cellCenter({th, r});
    if (this.has_enemy) {
      ctx.fillStyle = ENEMY_COLOR;
      ctx.moveTo(dot_center.x, dot_center.y);
      ctx.beginPath();
      ctx.arc(dot_center.x, dot_center.y, ENEMY_RADIUS, 0, 2*Math.PI);
      ctx.fill();
    }
    if (DRAW_CELL_NUMBERS) {
      ctx.fillStyle = 'red';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 0.2;
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let cell_num = th + r * NUM_ANGLES;
      ctx.strokeText(cell_num.toString(),
        dot_center.x, dot_center.y);
      ctx.fillText(cell_num.toString(),
        dot_center.x, dot_center.y);
    }
  }
};

export class Wheel {
  private readonly layers: Layers;
  private readonly canvases: Canvases;
  private readonly wheel: Cell[];
  private current_movement?: RingMovement;
  private animation: Animation;

  constructor(canvases: Canvases) {
    this.canvases = canvases;
    let canvas_size = {
      width: canvases.wheel.width,
      height: canvases.wheel.height,
    };
    let layers = {} as Layers;
    for (let layer_name in canvases) {
      let canvas = canvases[layer_name as LayerName];
      if (canvas.width !== canvas_size.width ||
        canvas.height !== canvas_size.height) {
          throw Error('Uneven canvas size!');
      }
      if (!canvas.getContext) { throw Error('No canvas context!'); }
      let ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(canvas.width / FRAME.width, canvas.height / FRAME.height);
      layers[layer_name as LayerName] = ctx;
    }
    this.layers = layers;
    this.wheel = [];
    for (let i = 0; i < NUM_CELLS; ++i) {
      let color = (((i % 2 + Math.floor(i / NUM_ANGLES)) % 2 === 0)
        ? CELL1_FILL : CELL2_FILL);
      this.wheel.push(new Cell(color));
    }
    this.animation = new Animation(
      RING_ROTATE_ANIMATION_TIME,
      amount => {
        if (!this.current_movement) { throw Error('Last movement null?'); }
        if (this.current_movement.type === 'ring'
            && !this.current_movement.clockwise ||
            this.current_movement.type === 'row'
            && !this.current_movement.outward) {
          amount = -amount;
        }
        this.drawGroup(this.current_movement, amount);
      },
      () => {
        if (!this.current_movement) { throw Error('Last movement null?'); }
        this.move(this.current_movement, false);
        this.current_movement = null;
      }
    );
    this.current_movement = null;
  }

  move(m: RingMovement, animate: boolean = true) {
    if (animate) {
      if (this.animation.isPlaying()) { return; }
      this.current_movement = m;
      this.animation.play(
        this.current_movement.type === 'ring' ?
        RING_ROTATE_ANIMATION_TIME : RING_SHIFT_ANIMATION_TIME);
      return;
    }
    if (m.type === 'ring') {
      this.rotateRing(m.r, m.clockwise);
    } else {
      this.shiftRow(m.th, m.outward);
    }
  }

  // Rotate ring `r` once.
  rotateRing(r: number, clockwise: boolean = false) {
    console.log('Rotate ring', r, clockwise ? 'clockwise' : 'anti-clockwise');
    let start = r*NUM_ANGLES;
    let step = 1;
    let end = (r+1)*NUM_ANGLES;
    let arr = this.wheel;
    if (clockwise) {
      step = -step;
      [start, end] = [end + step, start + step];
    }
    for (let i = start; i !== end - step; i += step) {
      [arr[i], arr[i + step]] = [arr[i + step], arr[i]];
    }
  }

  // Shift the row at angular position th.
  shiftRow(th: number, outward: boolean = false) {
    console.log('Shift row', th, outward ? 'outward' : 'inward');
    if (th >= NUM_ANGLES / 2) {
      this.shiftRow(th - NUM_ANGLES / 2, !outward);
      return;
    }
    let start = th;
    let step = NUM_ANGLES;
    let end = th + NUM_CELLS;
    if (outward) {
      start += step / 2;
      end += step / 2;
    }
    let arr = this.wheel;
    if ((end - start) % step !== 0) { throw 'wtf'; }
    if (NUM_ANGLES % 2 !== 0) { throw Error('NUM_ANGLES not even!'); }
    let i = start;
    let n = 0;
    while (++n < NUM_RINGS * 2) {
      let j = i + step;
      if (Math.round(j) === end) {
        j -= step / 2;
        if (outward) {
          j -= step;
        }
        step = -step;
      }
      [arr[i], arr[j]] = [arr[j], arr[i]];
      i = j;
    }
  }

  clickCell(pos: RingPosition) {
    this.getCell(pos).has_enemy = true;
  }

  getCell({th, r}: RingPosition) {
    if (th < 0 || th >= NUM_ANGLES || r < 0 || r >= NUM_RINGS) {
      throw Error(`Cell index out of range: {th: ${th}, r: ${r}}}`);
    }
    return this.wheel[th % NUM_ANGLES + r * NUM_ANGLES];
  }

  draw() {
    this.drawWheel();
    this.drawBackground();
  }

  getLayer(layer_name: LayerName = 'wheel'): Context | undefined {
    return this.layers[layer_name];
  }

  drawGroup(group: RingGroup, anim_amount: number = 0, both: boolean = true) {
    if (group.type === 'ring') {
      this.drawRing(group.r, anim_amount);
    } else {
      this.drawRow(group.th, anim_amount);
      if (both) {
        this.drawRow((group.th + NUM_ANGLES / 2) % NUM_ANGLES, -anim_amount);
      }
    }
  }

  drawRing(r: number, anim_amount: number = 0) {
    let base = this.getLayer();
    let enemies = this.getLayer('enemy');

    // Clear enemies in the ring.
    enemies.save();
    enemies.fillStyle = 'black';
    enemies.globalCompositeOperation = 'destination-out';
    enemies.moveTo(0, 0);
    enemies.beginPath();
    filledArc(enemies,
      0, 0,
      R0 + r*CELL_WIDTH, R0 + (r+1)*CELL_WIDTH,
      0, Math.PI * 2);
    enemies.fill();
    enemies.restore();

    for (let th = 0; th < NUM_ANGLES; ++th) {
      const cell = this.getCell({th, r});
      const th_shifted = th + anim_amount;
      cell.drawBase(base, {th: th_shifted, r});
      cell.drawTop(enemies, {th: th_shifted, r});
    }
  }

  drawRow(th: number, anim_amount: number = 0) {
    let base = this.getLayer();
    let enemies = this.getLayer('enemy');
    
    // Clear enemies in the row.
    enemies.save();
    enemies.fillStyle = 'black';
    enemies.globalCompositeOperation = 'destination-out';
    enemies.moveTo(0, 0);
    enemies.beginPath();
    filledArc(enemies, 0, 0, R0, R0 + CELL_WIDTH*NUM_RINGS,
      th*CELL_ANGLE, (th+1)*CELL_ANGLE);
    enemies.fill();
    enemies.restore();
    enemies.save();
    enemies.clip();
    try {
      for (let r = 0; r < NUM_RINGS; ++r) {
        const cell = this.getCell({th, r});
        let r_shifted = r + anim_amount;
        cell.drawBase(base, {th, r: r_shifted});
        cell.drawTop(enemies, {th, r: r_shifted});
      }
      if (anim_amount != 0) {
        const th_wrapped = (th + NUM_ANGLES / 2) % NUM_ANGLES;
        const r_wrapped = anim_amount < 0 ? NUM_RINGS - 1 : 0;
        const r_shifted = (anim_amount < 0 ? NUM_RINGS : -1) + anim_amount;
        const cell = this.getCell({th: th_wrapped, r: r_wrapped});
        cell.drawBase(base, {th, r: r_shifted});
        cell.drawTop(enemies, {th, r: r_shifted});
      }
    } finally {
      enemies.restore();
    }
  }

  drawCellTop(pos: RingPosition) {
    this.getCell(pos).drawTop(
      this.getLayer('enemy'), pos);
  }

  drawWheel() {
    // Wheel cells
    for (let r = 0; r < NUM_RINGS; ++r) {
      this.drawRing(r);
    }
  }

  drawBackground() {
    let ctx = this.getLayer('overlay');
    // Inner circle.
    ctx.fillStyle = INSIDE_BORDER;
    ctx.moveTo(0, 0);
    ctx.beginPath();
    ctx.arc(0, 0, R0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = INSIDE_FILL;
    ctx.moveTo(0, 0);
    ctx.beginPath();
    ctx.arc(0, 0, R0 - INSIDE_BORDER_WIDTH, 0, Math.PI*2);
    ctx.fill();

    // Outside circle.
    ctx.lineWidth = OUTSIDE_BORDER_WIDTH;
    ctx.fillStyle = OUTSIDE_FILL;
    ctx.strokeStyle = OUTSIDE_BORDER;
    ctx.moveTo(0, 0);
    ctx.beginPath();
    const OUTSIDE_R0 = R0 + NUM_RINGS * CELL_WIDTH;
    ctx.arc(0, 0, OUTSIDE_R0 + OUTSIDE_WIDTH, 0, Math.PI*2, false);
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, OUTSIDE_R0, 0, Math.PI*2, true);
    innerStroke(ctx);
  }

  // Converts from { x: canvas.offsetX, y: canvas.offsetY } to
  // the equivalent position in the drawing frame.
  offsetToFramePos(offsetPos: Point): Point {
    const style = window.getComputedStyle(this.canvases.wheel);
    const canvas_size = {
      width: parseInt(style.width, 10),
      height: parseInt(style.height, 10),
    };
    return {
      x: offsetPos.x / canvas_size.width * FRAME.width - FRAME.width / 2,
      y: offsetPos.y / canvas_size.height * FRAME.height - FRAME.height / 2,
    };
  }

  // Converts from { x: canvas.offsetX, y: canvas.offsetY } to
  // the equivalent position on the wheel, or null if there is none.
  offsetToWheelPos(offsetPos: Point): RingPosition | null {
    const {x, y} = this.offsetToFramePos(offsetPos);
    const th = Math.floor(Math.atan2(-y, -x) /
      (2*Math.PI) * NUM_ANGLES + NUM_ANGLES/2);
    const r = Math.floor((Math.sqrt(x*x + y*y) - R0) / CELL_WIDTH);
    if (r < 0 || r >= NUM_RINGS) { return null; }
    if (th < 0 || th >= NUM_ANGLES) { throw Error('Theta out of range??'); }
    return {th, r};
  }

  onMouseDown(event: MouseEvent) {
    const pos = this.offsetToWheelPos({x: event.offsetX, y: event.offsetY});
    if (!pos) { return; }
    console.log(pos);
    this.clickCell(pos);
    this.drawCellTop(pos);
  }
};
