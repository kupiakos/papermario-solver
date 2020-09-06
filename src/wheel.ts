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

export const CENTER = {x: 80, y: 80};
export const R0 = 25;
export const CELL_WIDTH = 10;

export const NUM_RINGS = 4;
export const NUM_ANGLES = 12;
export const NUM_CELLS = NUM_RINGS * NUM_ANGLES;
export const CELL_ANGLE = 2*Math.PI / NUM_ANGLES;
export const OUTSIDE_WIDTH = 15;

export const FRAME: Size = {
  width: CENTER.x + R0 + NUM_RINGS * CELL_WIDTH + OUTSIDE_WIDTH,
  height: CENTER.y + R0 + NUM_RINGS * CELL_WIDTH + OUTSIDE_WIDTH,
};

const CELL1_FILL = '#ada786';
const CELL2_FILL = '#8f8a6d';

const INSIDE_BORDER = '#bf7e56';
const INSIDE_FILL = '#a64250';

const OUTSIDE_FILL = '#5AE67C';
const OUTSIDE_BORDER = '#99851A';

const ENEMY_COLOR = '#ee0';
const ENEMY_RADIUS = 3;

const DRAW_CELL_NUMBERS = false;

function cellCenter({th, r}: RingPosition) {
  return {
      x: CENTER.x + (R0 + (r+0.5) * CELL_WIDTH) * Math.cos((th+.5) * CELL_ANGLE),
      y: CENTER.y + (R0 + (r+0.5) * CELL_WIDTH) * Math.sin((th+.5) * CELL_ANGLE),
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
    ctx.strokeStyle = 'black';
    ctx.fillStyle = this.fill;
    ctx.lineWidth = 0.5;
    ctx.moveTo(CENTER.x, CENTER.y);
    ctx.beginPath();
    filledArc(ctx,
      CENTER.x, CENTER.y,
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
  readonly layers: Layers;
  readonly canvases: Canvases;
  readonly canvas_size: Size;
  readonly wheel: Cell[];

  constructor(canvases: Canvases) {
    this.canvases = canvases;
    this.canvas_size = {
      width: canvases.wheel.width,
      height: canvases.wheel.height,
    };
    let layers = {} as Layers;
    for (let layer_name in canvases) {
      let canvas = canvases[layer_name as LayerName];
      if (canvas.width !== this.canvas_size.width ||
        canvas.height !== this.canvas_size.height) {
          throw 'Uneven canvas size!';
      }
      if (!canvas.getContext) { throw 'No canvas context!'; }
      let ctx = canvas.getContext('2d');
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
    if (NUM_ANGLES % 2 !== 0) { throw 'NUM_ANGLES not even!'; }
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
      throw 'Cell index out of range: ' + {th, r};
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

  drawRing(r: number) {
    let base = this.getLayer();
    let enemies = this.getLayer('enemy');

    // Clear enemies in the ring.
    enemies.save();
    enemies.fillStyle = 'black';
    enemies.globalCompositeOperation = 'destination-out';
    enemies.moveTo(CENTER.x, CENTER.y);
    enemies.beginPath();
    enemies.arc(CENTER.x, CENTER.y, R0 + (r+1)*CELL_WIDTH, 0, Math.PI*2, false);
    enemies.moveTo(CENTER.x, CENTER.y);
    enemies.arc(CENTER.x, CENTER.y, R0 + r*CELL_WIDTH, 0, Math.PI*2, true);
    enemies.fill();
    enemies.restore();

    for (let th = 0; th < NUM_ANGLES; ++th) {
      let cell = this.getCell({th, r});
      cell.drawBase(base, {th, r});
      cell.drawTop(enemies, {th, r});
    }
  }

  drawRow(th: number) {
    let base = this.getLayer();
    let enemies = this.getLayer('enemy');
    
    // Clear enemies in the row.
    enemies.save();
    enemies.fillStyle = 'black';
    enemies.globalCompositeOperation = 'destination-out';
    enemies.moveTo(CENTER.x, CENTER.y);
    enemies.beginPath();
    filledArc(enemies, CENTER.x, CENTER.y, R0, R0 + CELL_WIDTH*NUM_RINGS,
      th*CELL_ANGLE, (th+1)*CELL_ANGLE);
    enemies.fill();
    enemies.restore();

    for (let r = 0; r < NUM_RINGS; ++r) {
      let cell = this.getCell({th, r});
      cell.drawBase(base, {th, r});
      cell.drawTop(enemies, {th, r});
    }
  }

  drawCellTop(pos: RingPosition) {
    this.getCell(pos).drawTop(this.getLayer('enemy'), pos);
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
    ctx.moveTo(CENTER.x, CENTER.y);
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, R0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = INSIDE_FILL;
    ctx.moveTo(CENTER.x, CENTER.y);
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, R0 - 2, 0, Math.PI*2);
    ctx.fill();

    // Outside circle.
    ctx.lineWidth = 2;
    ctx.fillStyle = OUTSIDE_FILL;
    ctx.strokeStyle = OUTSIDE_BORDER;
    ctx.moveTo(CENTER.x, CENTER.y);
    ctx.beginPath();
    const OUTSIDE_R0 = R0 + NUM_RINGS * CELL_WIDTH;
    ctx.arc(CENTER.x, CENTER.y, OUTSIDE_R0 + OUTSIDE_WIDTH, 0, Math.PI*2, false);
    ctx.moveTo(CENTER.x, CENTER.y);
    ctx.arc(CENTER.x, CENTER.y, OUTSIDE_R0, 0, Math.PI*2, true);
    innerStroke(ctx);
  }

  // FIXME: Returns the wrong result when CSS scaled.
  xyToWheelPos(pos: Point): RingPosition {
    let x = pos.x / this.canvas_size.width * FRAME.width - CENTER.x;
    let y = pos.y / this.canvas_size.height * FRAME.height - CENTER.y;
    let th = Math.floor(Math.atan2(-y, -x) /
      (2*Math.PI) * NUM_ANGLES + NUM_ANGLES/2);
    let r = Math.floor((Math.sqrt(x*x + y*y) - R0)
      / CELL_WIDTH);
    if (r < 0 || r >= NUM_RINGS) { return null; }
    if (th < 0 || th >= NUM_ANGLES) { throw 'Theta out of range??'; }
    return {th, r};
  }

  onMouseDown(event: MouseEvent) {
    let pos = this.xyToWheelPos({x: event.offsetX, y: event.offsetY});
    if (!pos) { return; }
    console.log(pos);
    this.clickCell(pos);
    this.drawCellTop(pos);
  }
};
