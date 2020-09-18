import {Animation} from './animation';

type Context = CanvasRenderingContext2D;
type LayerName = 'overlay' | 'enemy' | 'cursor' | 'ring';

type Layers = {
  [name in LayerName]: Context;
};

type Canvases = {
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

export type RingSubring = {type: 'ring'; r: number};
export type RingRow = {type: 'row'; th: number};
export type RingGroupType = 'ring' | 'row';
export type RingGroup = RingSubring | RingRow;

export type RingRotate = RingSubring & {clockwise: boolean; amount: number};
export type RingShift = RingRow & {outward: boolean; amount: number};
export type RingMovement = RingRotate | RingShift;

export const R0 = 77;
export const CELL_WIDTH = 32;

export const NUM_RINGS = 4;
export const NUM_ANGLES = 12;
export const NUM_CELLS = NUM_RINGS * NUM_ANGLES;
export const CELL_ANGLE = (2 * Math.PI) / NUM_ANGLES;
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
    x: (R0 + (r + 0.5) * CELL_WIDTH) * Math.cos((th + 0.5) * CELL_ANGLE),
    y: (R0 + (r + 0.5) * CELL_WIDTH) * Math.sin((th + 0.5) * CELL_ANGLE),
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

function simplifyMovement(m: RingMovement): RingMovement {
  if (m.amount <= 0) {
    throw new Error('movement with negative amount');
  }
  if (m.type === 'ring') {
    const amount = m.amount % NUM_ANGLES;
    if (amount > NUM_ANGLES / 2) {
      return {...m, amount: NUM_ANGLES - amount, clockwise: !m.clockwise};
    }
    return {...m, amount};
  }
  const amount = m.amount % (NUM_RINGS * 2);
  if (amount > NUM_RINGS) {
    return {...m, amount: NUM_RINGS - amount};
  }
  return {...m, amount};
}

export function combineMovements(
  m1: RingMovement | null,
  m2: RingMovement
): RingMovement | null {
  if (m1 === null) {
    return m2;
  }
  if (m1.type === 'ring' && m2.type === 'ring') {
    if (m1.r !== m2.r) {
      return null;
    }
    const amount =
      (m1.clockwise ? m1.amount : -m1.amount) +
      (m2.clockwise ? m2.amount : -m2.amount);
    if (amount === 0) {
      return null;
    }
    return simplifyMovement({
      type: 'ring',
      amount: Math.abs(amount),
      clockwise: amount > 0,
      r: m1.r,
    });
  } else if (m1.type === 'row' && m2.type === 'row') {
    if (m1.th !== m2.th) {
      return null;
    }
    const amount =
      (m1.outward ? m1.amount : -m1.amount) +
      (m2.outward ? m2.amount : -m2.amount);
    if (amount === 0) {
      return null;
    }
    return simplifyMovement({
      type: 'row',
      amount: Math.abs(amount),
      outward: amount > 0,
      th: m1.th,
    });
  }
  return null;
}

export function reverseMovement(m: RingMovement): RingMovement {
  if (m.type === 'ring') {
    return {...m, clockwise: !m.clockwise};
  } else {
    return {...m, outward: !m.outward};
  }
}

export function filledArc(
  ctx: Context,
  x: number,
  y: number,
  r1: number,
  r2: number,
  startAngle: number,
  endAngle: number,
  anticlockwise = false
) {
  ctx.arc(x, y, r1, startAngle, endAngle, anticlockwise);
  ctx.arc(x, y, r2, endAngle, startAngle, !anticlockwise);
  ctx.closePath();
}

class Cell {
  hasEnemy: boolean;
  private readonly fill_: string;

  constructor(fill: string) {
    this.fill_ = fill;
    this.hasEnemy = false;
  }

  drawBase(ctx: Context, {th, r}: RingPosition) {
    ctx.strokeStyle = CELL_BORDER;
    ctx.fillStyle = this.fill_;
    ctx.lineWidth = CELL_BORDER_WIDTH;
    ctx.moveTo(0, 0);
    ctx.beginPath();
    const rStart = R0 + r * CELL_WIDTH;
    const rEnd = rStart + CELL_WIDTH;
    const thStart = th * CELL_ANGLE;
    const thEnd = thStart + CELL_ANGLE;
    filledArc(ctx, 0, 0, rStart, rEnd, thStart, thEnd);
    innerStroke(ctx);
  }

  drawTop(ctx: Context, {th, r}: RingPosition) {
    const dotCenter = cellCenter({th, r});
    if (this.hasEnemy) {
      ctx.fillStyle = ENEMY_COLOR;
      ctx.moveTo(dotCenter.x, dotCenter.y);
      ctx.beginPath();
      ctx.arc(dotCenter.x, dotCenter.y, ENEMY_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
    }
    if (DRAW_CELL_NUMBERS) {
      ctx.fillStyle = 'red';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 0.2;
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cellNum = th + r * NUM_ANGLES;
      ctx.strokeText(cellNum.toString(), dotCenter.x, dotCenter.y);
      ctx.fillText(cellNum.toString(), dotCenter.x, dotCenter.y);
    }
  }
}

export class Ring {
  private readonly layers_: Layers;
  private readonly canvases_: Canvases;
  private readonly ringContents: Cell[];
  private readonly animation_: Animation;
  private currentMovement_: RingMovement | null;
  private readyCallbacks_: {(): void}[];

  constructor(canvases: Canvases) {
    this.canvases_ = canvases;
    const canvasSize = {
      width: canvases.ring.width,
      height: canvases.ring.height,
    };
    const layers = {} as Layers;
    for (const layerName in canvases) {
      const canvas = canvases[layerName as LayerName];
      if (
        canvas.width !== canvasSize.width ||
        canvas.height !== canvasSize.height
      ) {
        throw new RangeError('Uneven canvas size!');
      }
      if (!canvas.getContext) {
        throw new ReferenceError('No canvas context!');
      }
      const ctx = canvas.getContext('2d');
      if (ctx === null) {
        throw new ReferenceError('canvas.getContext null');
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(canvas.width / FRAME.width, canvas.height / FRAME.height);
      layers[layerName as LayerName] = ctx;
    }
    this.layers_ = layers;
    this.ringContents = [];
    for (let i = 0; i < NUM_CELLS; ++i) {
      const color =
        ((i % 2) + Math.floor(i / NUM_ANGLES)) % 2 === 0
          ? CELL1_FILL
          : CELL2_FILL;
      this.ringContents.push(new Cell(color));
    }
    this.animation_ = new Animation(
      RING_ROTATE_ANIMATION_TIME,
      amount => {
        if (!this.currentMovement_) {
          throw new ReferenceError('Last movement null?');
        }
        if (Ring.isNegativeMovement(this.currentMovement_)) {
          amount = -amount;
        }
        this.drawGroup(this.currentMovement_, amount);
      },
      () => {
        if (!this.currentMovement_) {
          throw new ReferenceError('Last movement null?');
        }
        this.move(this.currentMovement_, false);
        if (--this.currentMovement_.amount > 0) {
          this.animation_.play();
        } else {
          this.currentMovement_ = null;
          this.readyCallbacks_.forEach(cb => {
            cb();
          });
          this.readyCallbacks_ = [];
        }
      }
    );
    this.currentMovement_ = null;
    this.readyCallbacks_ = [];
  }

  private static isNegativeMovement(m: RingMovement): boolean {
    return (
      (m.type === 'ring' && !m.clockwise) || (m.type === 'row' && !m.outward)
    );
  }

  isBusy(): boolean {
    return this.animation_.isPlaying();
  }

  onReady<T>(cb: () => T): T | undefined {
    if (!this.animation_.isPlaying()) {
      return cb();
    }
    this.readyCallbacks_.push(cb);
    return;
  }

  move(m: RingMovement, animate = true) {
    if (m.amount < 1) {
      throw new RangeError(`move amount ${m.amount} < 1`);
    }
    if (animate) {
      if (this.isBusy()) {
        return;
      }
      this.currentMovement_ = {...m};
      this.animation_.play(
        this.currentMovement_.type === 'ring'
          ? RING_ROTATE_ANIMATION_TIME
          : RING_SHIFT_ANIMATION_TIME
      );
      return;
    }
    if (m.type === 'ring') {
      this.rotateRing(m.r, m.clockwise);
    } else {
      this.shiftRow(m.th, m.outward);
    }
  }

  // Rotate ring `r` once.
  private rotateRing(r: number, clockwise = false) {
    console.log('Rotate ring', r, clockwise ? 'clockwise' : 'anti-clockwise');
    let start = r * NUM_ANGLES;
    let step = 1;
    let end = (r + 1) * NUM_ANGLES;
    const arr = this.ringContents;
    if (clockwise) {
      step = -step;
      [start, end] = [end + step, start + step];
    }
    for (let i = start; i !== end - step; i += step) {
      [arr[i], arr[i + step]] = [arr[i + step], arr[i]];
    }
  }

  // Shift the row at angular position th.
  private shiftRow(th: number, outward = false) {
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
    const arr = this.ringContents;
    if ((end - start) % step !== 0) {
      throw new RangeError('wtf');
    }
    if (NUM_ANGLES % 2 !== 0) {
      throw new RangeError('NUM_ANGLES not even!');
    }
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
    this.getCell(pos).hasEnemy = true;
  }

  getCell({th, r}: RingPosition) {
    if (th < 0 || th >= NUM_ANGLES || r < 0 || r >= NUM_RINGS) {
      throw new RangeError(`Cell index out of range: {th: ${th}, r: ${r}}}`);
    }
    return this.ringContents[(th % NUM_ANGLES) + r * NUM_ANGLES];
  }

  draw() {
    this.drawRing();
    this.drawBackground();
  }

  getLayer(layer_name: LayerName = 'ring'): Context {
    const layer = this.layers_[layer_name];
    if (layer === undefined) {
      throw new ReferenceError(`No layer named ${layer_name}!`);
    }
    return layer;
  }

  drawGroup(group: RingGroup, anim_amount = 0, both = true) {
    if (group.type === 'ring') {
      this.drawSubring(group.r, anim_amount);
    } else {
      this.drawRow(group.th, anim_amount);
      if (both) {
        this.drawRow((group.th + NUM_ANGLES / 2) % NUM_ANGLES, -anim_amount);
      }
    }
  }

  drawSubring(r: number, anim_amount = 0) {
    const base = this.getLayer();
    const enemies = this.getLayer('enemy');

    // Clear enemies in the ring.
    enemies.save();
    enemies.fillStyle = 'black';
    enemies.globalCompositeOperation = 'destination-out';
    enemies.moveTo(0, 0);
    enemies.beginPath();
    const rStart = R0 + r * CELL_WIDTH;
    const rEnd = rStart + CELL_WIDTH;
    filledArc(enemies, 0, 0, rStart, rEnd, 0, Math.PI * 2);
    enemies.fill();
    enemies.restore();

    for (let th = 0; th < NUM_ANGLES; ++th) {
      const cell = this.getCell({th, r});
      const thShifted = th + anim_amount;
      cell.drawBase(base, {th: thShifted, r});
      cell.drawTop(enemies, {th: thShifted, r});
    }
  }

  drawRow(th: number, anim_amount = 0) {
    const base = this.getLayer();
    const enemies = this.getLayer('enemy');

    // Clear enemies in the row.
    enemies.save();
    enemies.fillStyle = 'black';
    enemies.globalCompositeOperation = 'destination-out';
    enemies.moveTo(0, 0);
    enemies.beginPath();
    const rEnd = R0 + CELL_WIDTH * NUM_RINGS;
    const thStart = th * CELL_ANGLE;
    const thEnd = thStart + CELL_ANGLE;
    filledArc(enemies, 0, 0, R0, rEnd, thStart, thEnd);
    enemies.fill();
    enemies.restore();
    enemies.save();
    enemies.clip();
    try {
      for (let r = 0; r < NUM_RINGS; ++r) {
        const cell = this.getCell({th, r});
        const rShifted = r + anim_amount;
        cell.drawBase(base, {th, r: rShifted});
        cell.drawTop(enemies, {th, r: rShifted});
      }
      if (anim_amount !== 0) {
        const thWrapped = (th + NUM_ANGLES / 2) % NUM_ANGLES;
        const rWrapped = anim_amount < 0 ? NUM_RINGS - 1 : 0;
        const rShifted = (anim_amount < 0 ? NUM_RINGS : -1) + anim_amount;
        const cell = this.getCell({th: thWrapped, r: rWrapped});
        cell.drawBase(base, {th, r: rShifted});
        cell.drawTop(enemies, {th, r: rShifted});
      }
    } finally {
      enemies.restore();
    }
  }

  drawCellTop(pos: RingPosition) {
    this.getCell(pos).drawTop(this.getLayer('enemy'), pos);
  }

  drawRing() {
    // Ring cells
    for (let r = 0; r < NUM_RINGS; ++r) {
      this.drawSubring(r);
    }
  }

  drawBackground() {
    const ctx = this.getLayer('overlay');
    // Inner circle.
    ctx.fillStyle = INSIDE_BORDER;
    ctx.moveTo(0, 0);
    ctx.beginPath();
    ctx.arc(0, 0, R0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INSIDE_FILL;
    ctx.moveTo(0, 0);
    ctx.beginPath();
    ctx.arc(0, 0, R0 - INSIDE_BORDER_WIDTH, 0, Math.PI * 2);
    ctx.fill();

    // Outside circle.
    ctx.lineWidth = OUTSIDE_BORDER_WIDTH;
    ctx.fillStyle = OUTSIDE_FILL;
    ctx.strokeStyle = OUTSIDE_BORDER;
    ctx.moveTo(0, 0);
    ctx.beginPath();
    const OUTSIDE_R0 = R0 + NUM_RINGS * CELL_WIDTH;
    ctx.arc(0, 0, OUTSIDE_R0 + OUTSIDE_WIDTH, 0, Math.PI * 2, false);
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, OUTSIDE_R0, 0, Math.PI * 2, true);
    innerStroke(ctx);
  }

  // Converts from { x: canvas.offsetX, y: canvas.offsetY } to
  // the equivalent position in the drawing frame.
  offsetToFramePos(offsetPos: Point): Point {
    const style = window.getComputedStyle(this.canvases_.ring);
    const canvasSize = {
      width: parseInt(style.width, 10),
      height: parseInt(style.height, 10),
    };
    return {
      x: (offsetPos.x / canvasSize.width) * FRAME.width - FRAME.width / 2,
      y: (offsetPos.y / canvasSize.height) * FRAME.height - FRAME.height / 2,
    };
  }

  // Converts from { x: canvas.offsetX, y: canvas.offsetY } to
  // the equivalent position on the ring, or null if there is none.
  offsetToRingPos(offsetPos: Point): RingPosition | null {
    const {x, y} = this.offsetToFramePos(offsetPos);
    const th = Math.floor(
      (Math.atan2(-y, -x) / (2 * Math.PI)) * NUM_ANGLES + NUM_ANGLES / 2
    );
    const r = Math.floor((Math.sqrt(x * x + y * y) - R0) / CELL_WIDTH);
    if (r < 0 || r >= NUM_RINGS) {
      return null;
    }
    if (th < 0 || th >= NUM_ANGLES) {
      throw new RangeError('Theta out of range??');
    }
    return {th, r};
  }

  onMouseDown(event: MouseEvent) {
    const pos = this.offsetToRingPos({x: event.offsetX, y: event.offsetY});
    if (!pos) {
      return;
    }
    console.log(pos);
    this.clickCell(pos);
    this.drawCellTop(pos);
  }
}
