import {Animation} from './animation';
import {RingGroup, RingGroupType, RingMovement} from './movement';
import {DEFAULT_RING_SETTINGS, RingSettings} from './ring_settings';

type Context = CanvasRenderingContext2D;
type LayerName = 'overlay' | 'enemy' | 'cursor' | 'ring';

type Layers = {
  [name in LayerName]: Context;
};

type Canvases = {
  [name in LayerName]: HTMLCanvasElement;
};

export interface Size {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

export interface RingStyle {
  // the radius from the center to the start of the first cell
  r0: number;

  frame: Size;

  // The style of the inner circle (where mario goes).
  inner?: ArcStyle;

  // The style of the outer circle (where the "grass" is)
  outer?: ArcStyle;

  // The style for each cell.
  even_cell: ArcStyle;
  odd_cell: ArcStyle;

  enemy_style: EnemyStyle;

  move_styles: {[K in 'rotate' | 'shift']: MoveStyle};
}

export interface ArcStyle {
  border: string;
  border_width: number;
  fill: string;
  r0: number;
  width: number;
  angle?: number;
}

interface EnemyStyle {
  color: string;
  radius: number;
}

export interface MoveStyle {
  animation_time: number;
  undo_animation_time: number;
}

export interface RingPosition {
  r: number;
  th: number;
}

const DEFAULT_R0 = 60;
const DEFAULT_CELL_WIDTH = 32;

const DEFAULT_NUM_RINGS = 4;
const DEFAULT_NUM_ANGLES = 12;
const DEFAULT_NUM_CELLS = DEFAULT_NUM_RINGS * DEFAULT_NUM_ANGLES;
const DEFAULT_CELL_ANGLE = (2 * Math.PI) / DEFAULT_NUM_ANGLES;
const OUTSIDE_WIDTH = 40;

export enum AnimationMode {
  NONE = 0,
  NORMAL = 1,
  UNDO = 2,
}

const DEFAULT_CELL: ArcStyle = {
  border: 'black',
  border_width: 0.8,
  r0: DEFAULT_R0,
  width: 32,
  fill: 'white',
  angle: (2 * Math.PI) / DEFAULT_NUM_ANGLES,
  // width: ,
};

export const DEFAULT_RING_STYLE = {
  r0: DEFAULT_R0,
  frame: {
    width:
      (DEFAULT_R0 + DEFAULT_NUM_RINGS * DEFAULT_CELL_WIDTH + OUTSIDE_WIDTH) * 2,
    height:
      (DEFAULT_R0 + DEFAULT_NUM_RINGS * DEFAULT_CELL_WIDTH + OUTSIDE_WIDTH) * 2,
  },
  inner: {
    r0: 0,
    border: '#bf7e56',
    border_width: 6,
    fill: '#a64250',
    width: DEFAULT_R0,
  },
  outer: {
    r0: DEFAULT_R0,
    border: '#99851a',
    border_width: 6,
    fill: '#5ae67c',
    width: 40,
  },
  even_cell: {
    ...DEFAULT_CELL,
    fill: '#ada786',
  },
  odd_cell: {
    ...DEFAULT_CELL,
    fill: '#8f8a6d',
  },
  enemy_style: {
    color: '#ee0',
    radius: 9,
  },
  move_styles: {
    rotate: {
      animation_time: 0.15,
      undo_animation_time: 0.05,
    },
    shift: {
      animation_time: 0.2,
      undo_animation_time: 0.08,
    },
  },
};

function cellCenter({th, r}: RingPosition) {
  return {
    x:
      (DEFAULT_R0 + (r + 0.5) * DEFAULT_CELL_WIDTH) *
      Math.cos((th + 0.5) * DEFAULT_CELL_ANGLE),
    y:
      (DEFAULT_R0 + (r + 0.5) * DEFAULT_CELL_WIDTH) *
      Math.sin((th + 0.5) * DEFAULT_CELL_ANGLE),
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
  style: ArcStyle;

  constructor(style: ArcStyle) {
    // this.fill_ = fill;
    this.hasEnemy = false;
    this.style = style;
  }

  drawBase(ctx: Context, pos: RingPosition) {
    ctx.strokeStyle = this.style.border;
    ctx.fillStyle = this.style.fill;
    ctx.lineWidth = this.style.border_width;
    this.basePath(ctx, pos);
    innerStroke(ctx);
  }

  drawTop(ctx: Context, {th, r}: RingPosition, enemy_style: EnemyStyle) {
    if (this.hasEnemy) {
      ctx.fillStyle = enemy_style.color;
      const dotCenter = cellCenter({th, r});
      ctx.moveTo(dotCenter.x, dotCenter.y);
      ctx.beginPath();
      ctx.arc(dotCenter.x, dotCenter.y, enemy_style.radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  clearTop(ctx: Context, pos: RingPosition) {
    ctx.save();
    ctx.fillStyle = 'black';
    ctx.globalCompositeOperation = 'destination-out';
    this.basePath(ctx, pos);
    ctx.fill();
    ctx.restore();
  }

  private basePath(ctx: Context, {th, r}: RingPosition) {
    ctx.moveTo(0, 0);
    ctx.beginPath();
    const rStart = this.style.r0 + r * this.style.width;
    const rEnd = rStart + this.style.width;
    const thStart = th * (this.style.angle ?? Math.PI * 2);
    const thEnd = thStart + (this.style.angle ?? Math.PI * 2);
    filledArc(ctx, 0, 0, rStart, rEnd, thStart, thEnd);
  }
}

export class Ring {
  private readonly layers: Layers;
  private readonly canvases: Canvases;
  private readonly ringContents: Cell[];
  private readonly animation: Animation;
  private readonly settings: RingSettings;
  private currentMovement: RingMovement | null;
  private readyCallbacks: {(): void}[];
  private style: RingStyle;

  constructor(
    canvases: Canvases,
    settings: RingSettings = DEFAULT_RING_SETTINGS,
    style: RingStyle = DEFAULT_RING_STYLE
  ) {
    this.canvases = canvases;
    this.settings = settings;
    this.style = style;
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
      ctx.scale(
        canvas.width / this.style.frame.width,
        canvas.height / this.style.frame.height
      );
      layers[layerName as LayerName] = ctx;
    }
    this.layers = layers;
    this.ringContents = [];
    const numCells = this.settings.num_rings * this.settings.num_angles;
    for (let i = 0; i < numCells; ++i) {
      const style =
        ((i % 2) + Math.floor(i / this.settings.num_angles)) % 2 === 0
          ? this.style.even_cell
          : this.style.odd_cell;
      this.ringContents.push(new Cell(style));
    }
    this.animation = new Animation(
      this.style.move_styles.rotate.animation_time,
      amount => {
        if (!this.currentMovement) {
          throw new ReferenceError('Last movement null?');
        }
        if (Ring.isNegativeMovement(this.currentMovement)) {
          amount = -amount;
        }
        this.drawGroup(this.currentMovement, amount);
      },
      () => {
        if (!this.currentMovement) {
          throw new ReferenceError('Last movement null?');
        }
        this.move(this.currentMovement);
        if (--this.currentMovement.amount > 0) {
          this.animation.play();
        } else {
          this.currentMovement = null;
          while (this.readyCallbacks.length > 0) {
            const cb = this.readyCallbacks.shift();
            if (!cb) {
              throw new ReferenceError('cb null???');
            }
            cb();
            if (this.currentMovement !== null) {
              // This callback started a new movement.
              break;
            }
          }
        }
      }
    );
    this.currentMovement = null;
    this.readyCallbacks = [];
  }

  private static isNegativeMovement(m: RingMovement): boolean {
    return (
      (m.type === 'ring' && !m.clockwise) || (m.type === 'row' && !m.outward)
    );
  }

  isBusy(): boolean {
    return this.animation.isPlaying();
  }

  async waitUntilReady(): Promise<void> {
    if (!this.isBusy()) {
      return Promise.resolve();
    }
    return new Promise(resolve => this.readyCallbacks.push(resolve));
  }

  async animateMove(
    m: RingMovement,
    animate: AnimationMode = AnimationMode.NORMAL
  ): Promise<void> {
    await this.waitUntilReady();
    if (animate === AnimationMode.NONE) {
      this.move(m);
      return;
    }
    this.currentMovement = {...m};
    this.animation.play(this.animationSpeed(m.type, animate));
    await this.waitUntilReady();
  }

  move(m: RingMovement) {
    if (m.amount < 1) {
      throw new RangeError(`move amount ${m.amount} < 1`);
    }
    if (m.type === 'ring') {
      this.rotateRing(m.r, m.clockwise);
    } else {
      this.shiftRow(m.th, m.outward);
    }
  }

  // Rotate ring `r` once.
  private rotateRing(r: number, clockwise: boolean) {
    console.log('Rotate ring', r, clockwise ? 'clockwise' : 'anti-clockwise');
    let start = r * this.settings.num_angles;
    let step = 1;
    let end = (r + 1) * this.settings.num_angles;
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
  private shiftRow(th: number, outward: boolean) {
    console.log('Shift row', th, outward ? 'outward' : 'inward');
    if (th >= this.settings.num_angles / 2) {
      this.shiftRow(th - this.settings.num_angles / 2, !outward);
      return;
    }
    let start = th;
    let step = this.settings.num_angles;
    let end = th + this.settings.num_rings * this.settings.num_angles;
    if (outward) {
      start += step / 2;
      end += step / 2;
    }
    const arr = this.ringContents;
    if ((end - start) % step !== 0) {
      throw new RangeError('wtf');
    }
    if (this.settings.num_angles % 2 !== 0) {
      throw new RangeError('this.settings.num_angles not even!');
    }
    let i = start;
    let n = 0;
    while (++n < this.settings.num_rings * 2) {
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

  getCell({th, r}: RingPosition) {
    if (
      th < 0 ||
      th >= this.settings.num_angles ||
      r < 0 ||
      r >= this.settings.num_rings
    ) {
      throw new RangeError(`Cell index out of range: {th: ${th}, r: ${r}}}`);
    }
    return this.ringContents[
      (th % this.settings.num_angles) + r * this.settings.num_angles
    ];
  }

  draw() {
    this.drawRing();
    this.drawBackground();
  }

  getLayer(layer_name: LayerName = 'ring'): Context {
    const layer = this.layers[layer_name];
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
        this.drawRow(
          (group.th + this.settings.num_angles / 2) % this.settings.num_angles,
          -anim_amount
        );
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
    const rStart = this.style.r0 + r * this.style.even_cell.width;
    const rEnd = rStart + this.style.even_cell.width;
    filledArc(enemies, 0, 0, rStart, rEnd, 0, Math.PI * 2);
    enemies.fill();
    enemies.restore();

    for (let th = 0; th < this.settings.num_angles; ++th) {
      const cell = this.getCell({th, r});
      const thShifted = th + anim_amount;
      cell.drawBase(base, {th: thShifted, r});
      cell.drawTop(enemies, {th: thShifted, r}, this.style.enemy_style);
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
    const width = this.style.even_cell.width;
    const angle = this.style.even_cell.angle ?? Math.PI * 2;
    const rEnd = this.style.r0 + width * this.settings.num_rings;
    const thStart = th * angle;
    const thEnd = thStart + angle;
    filledArc(enemies, 0, 0, this.style.r0, rEnd, thStart, thEnd);
    enemies.fill();
    enemies.restore();
    enemies.save();
    enemies.clip();
    try {
      for (let r = 0; r < this.settings.num_rings; ++r) {
        const cell = this.getCell({th, r});
        const rShifted = r + anim_amount;
        cell.drawBase(base, {th, r: rShifted});
        cell.drawTop(enemies, {th, r: rShifted}, this.style.enemy_style);
      }
      if (anim_amount !== 0) {
        const thWrapped =
          (th + this.settings.num_angles / 2) % this.settings.num_angles;
        const rWrapped = anim_amount < 0 ? this.settings.num_rings - 1 : 0;
        const rShifted =
          (anim_amount < 0 ? this.settings.num_rings : -1) + anim_amount;
        const cell = this.getCell({th: thWrapped, r: rWrapped});
        cell.drawBase(base, {th, r: rShifted});
        cell.drawTop(enemies, {th, r: rShifted}, this.style.enemy_style);
      }
    } finally {
      enemies.restore();
    }
  }

  drawRing() {
    // Ring cells
    for (let r = 0; r < this.settings.num_rings; ++r) {
      this.drawSubring(r);
    }
  }

  drawBackground() {
    const ctx = this.getLayer('overlay');
    // Inner circle.
    if (this.style.inner !== undefined) {
      ctx.fillStyle = this.style.inner.border;
      ctx.moveTo(0, 0);
      ctx.beginPath();
      ctx.arc(0, 0, DEFAULT_R0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.style.inner.fill;
      ctx.moveTo(0, 0);
      ctx.beginPath();
      ctx.arc(0, 0, DEFAULT_R0 - this.style.inner.border_width, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.style.outer !== undefined) {
      // Outside circle.
      ctx.lineWidth = this.style.outer.border_width;
      ctx.fillStyle = this.style.outer.fill;
      ctx.strokeStyle = this.style.outer.border;
      ctx.moveTo(0, 0);
      ctx.beginPath();
      const OUTSIDE_R0 =
        DEFAULT_R0 + this.settings.num_rings * DEFAULT_CELL_WIDTH;
      ctx.arc(0, 0, OUTSIDE_R0 + OUTSIDE_WIDTH, 0, Math.PI * 2, false);
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, OUTSIDE_R0, 0, Math.PI * 2, true);
      innerStroke(ctx);
    }
  }

  // Converts from { x: canvas.offsetX, y: canvas.offsetY } to
  // the equivalent position in the drawing frame.
  offsetToFramePos(offsetPos: Point): Point {
    const style = window.getComputedStyle(this.canvases.ring);
    const canvasSize = {
      width: parseInt(style.width, 10),
      height: parseInt(style.height, 10),
    };
    return {
      x:
        (offsetPos.x / canvasSize.width) * this.style.frame.width -
        this.style.frame.width / 2,
      y:
        (offsetPos.y / canvasSize.height) * this.style.frame.height -
        this.style.frame.height / 2,
    };
  }

  // Converts from { x: canvas.offsetX, y: canvas.offsetY } to
  // the equivalent position on the ring, or null if there is none.
  offsetToRingPos(offsetPos: Point): RingPosition | null {
    const {x, y} = this.offsetToFramePos(offsetPos);
    const th = Math.floor(
      (Math.atan2(-y, -x) / (2 * Math.PI)) * this.settings.num_angles +
        this.settings.num_angles / 2
    );
    const r = Math.floor(
      (Math.sqrt(x * x + y * y) - DEFAULT_R0) / DEFAULT_CELL_WIDTH
    );
    if (r < 0 || r >= this.settings.num_rings) {
      return null;
    }
    if (th < 0 || th >= this.settings.num_angles) {
      throw new RangeError('Theta out of range??');
    }
    return {th, r};
  }

  onMouseDown(event: MouseEvent) {
    const pos = this.offsetToRingPos({x: event.offsetX, y: event.offsetY});
    if (!pos) {
      return;
    }
    console.log('click', pos);
    const ctx = this.getLayer('enemy');
    const cell = this.getCell(pos);
    cell.hasEnemy = !cell.hasEnemy;
    cell.clearTop(ctx, pos);
    cell.drawTop(ctx, pos, this.style.enemy_style);
  }

  private animationSpeed(type: RingGroupType, animate: AnimationMode): number {
    switch (animate) {
      case AnimationMode.NONE:
        return 0;
      case AnimationMode.NORMAL:
        return type === 'ring'
          ? this.style.move_styles.rotate.animation_time
          : this.style.move_styles.shift.animation_time;
      case AnimationMode.UNDO:
        return type === 'ring'
          ? this.style.move_styles.rotate.undo_animation_time
          : this.style.move_styles.shift.undo_animation_time;
    }
  }
}
