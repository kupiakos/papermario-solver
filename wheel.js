
const CELL1_FILL = '#ada786';
const CELL2_FILL = '#8f8a6d';

const INSIDE_BORDER = '#bf7e56';
const INSIDE_FILL = '#a64250';

const OUTSIDE_FILL = '#5AE67C';
const OUTSIDE_BORDER = '#99851A';

const ENEMY_COLOR = '#ee0';
const ENEMY_RADIUS = 3;

const CENTER = {x: 80, y: 80};
const R0 = 25;
const CELL_WIDTH = 10;
const OUTSIDE_WIDTH = 15;
const FRAME = {
  width: CENTER.x + R0 + 4 * CELL_WIDTH + OUTSIDE_WIDTH,
  height: CENTER.y + R0 + 4 * CELL_WIDTH + OUTSIDE_WIDTH,
};
const NUM_RINGS = 4;
const NUM_ANGLES = 12;
const NUM_CELLS = NUM_RINGS * NUM_ANGLES;
const CELL_ANGLE = 2*Math.PI / NUM_ANGLES;
const DRAW_CELL_NUMBERS = false;

const SHIFT_INDICES = function() {
  let arr = [];
  for (let i = 0; i < NUM_CELLS * 2; i += NUM_ANGLES) {
    arr.push(i);
  }
  for (let i = NUM_CELLS - NUM_ANGLES / 2; i > 0; i -= NUM_ANGLES) {
    arr.push(i);
  }
  return arr;
}();

// https://stackoverflow.com/a/45125187
function innerStroke(ctx) {
  ctx.save();
  ctx.clip();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function filledArc(ctx, x, y, r1, r2, startAngle, endAngle, anticlockwise) {
  ctx.moveTo(x, y);
  ctx.beginPath();
  ctx.arc(x, y, r1, startAngle, endAngle, anticlockwise);
  ctx.arc(x, y, r2, endAngle, startAngle, !anticlockwise);
  ctx.closePath();
  innerStroke(ctx);
}

// Rotate shift all elements in `arr` with indices in order of
// Python range(start, end, step).
function arrayStepRotate(arr, start, end, step, rotateLeft) {
  if (step == 0) {
    throw 'Step cannot be 0!';
  }
  
}

class Cell {
  constructor(fill) {
    this.fill = fill;
    this.has_enemy = false;
  }
};

class Wheel {
  constructor(canvas) {
    this.canvas = canvas;
    if (!canvas.getContext) { throw 'No canvas context!'; }
    this.wheel = [];
    for (let i = 0; i < NUM_CELLS; ++i) {
      let color = (((i % 2 + Math.floor(i / NUM_ANGLES)) % 2 === 0)
        ? CELL1_FILL : CELL2_FILL);
      this.wheel.push(new Cell(color));
    }
  }

  // Rotate ring `r` once.
  rotateRing(r, clockwise) {
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
  shiftRow(th, outward) {
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
      console.log(i, j);
      [arr[i], arr[j]] = [arr[j], arr[i]];
      i = j;
    }
  }

  clickCell(pos) {
    this.getCell(pos).has_enemy = true;
  }

  getCell({th, r}) {
    if (th < 0 || th >= NUM_ANGLES || r < 0 || r >= NUM_RINGS) {
      throw 'Cell index out of range: ' + {th, r};
    }
    return this.wheel[th % NUM_ANGLES + r * NUM_ANGLES];
  }

  getContext() {
    let ctx = this.canvas.getContext('2d');
    ctx.scale(this.canvas.width / FRAME.width,
      this.canvas.height / FRAME.height);
    return ctx;
  }

  draw() {
    let ctx = this.getContext();
    this.drawWheel(ctx);
    this.drawBackground(ctx);
    return ctx;
  }

  drawRing(ctx, r) {
    for (let th = 0; th < NUM_ANGLES; ++th) {
      this.drawCell(ctx, {th, r});
    }
  }

  drawRow(ctx, th) {
    for (let r = 0; r < NUM_RINGS; ++r) {
      this.drawCell(ctx, {th, r});
    }
  }

  drawWheel(ctx) {
    // Wheel cells
    for (let r = 0; r < NUM_RINGS; ++r) {
      this.drawRing(ctx, r);
    }

    // Lines around wheel
    ctx.beginPath();
    ctx.lineWidth = .5;
    ctx.strokeStyle = 'black';
    for (let th = 0; th < NUM_ANGLES; ++th) {
        ctx.moveTo(
            CENTER.x + R0*Math.cos(th*CELL_ANGLE),
            CENTER.y + R0*Math.sin(th*CELL_ANGLE));
        ctx.lineTo(
            CENTER.x + (R0+CELL_WIDTH * 4)*Math.cos(th*CELL_ANGLE),
            CENTER.y + (R0+CELL_WIDTH * 4)*Math.sin(th*CELL_ANGLE));
    }
    ctx.stroke();
  }

  drawBackground(ctx) {
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
    const OUTSIDE_R0 = R0 + 4 * CELL_WIDTH;
    ctx.arc(CENTER.x, CENTER.y, OUTSIDE_R0 + OUTSIDE_WIDTH, 0, Math.PI*2, false);
    ctx.moveTo(CENTER.x, CENTER.y);
    ctx.arc(CENTER.x, CENTER.y, OUTSIDE_R0, 0, Math.PI*2, true);
    innerStroke(ctx);
  }

  drawCell(ctx, {th, r}) {
    const cell = this.getCell({th, r});
    ctx.strokeStyle = 'black';
    ctx.fillStyle = cell.fill;
    ctx.lineWidth = 0.5;
    filledArc(ctx,
      CENTER.x, CENTER.y,
      R0 + r * CELL_WIDTH, R0 + (r+1) * CELL_WIDTH,
      th*CELL_ANGLE, (th+1)*CELL_ANGLE,
      false);
    let dot_center = this.cellCenter({th, r});
    if (cell.has_enemy) {
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
      let cellNum = th + r * NUM_ANGLES;
      ctx.strokeText(cellNum.toString(),
        dot_center.x, dot_center.y);
      ctx.fillText(cellNum.toString(),
        dot_center.x, dot_center.y);
    }
  }

  xyToWheelPos(pos) {
    let x = pos.x / this.canvas.width * FRAME.width - CENTER.x;
    let y = pos.y / this.canvas.height * FRAME.height - CENTER.y;
    let th = Math.floor(Math.atan2(-y, -x) /
      (2*Math.PI) * NUM_ANGLES + NUM_ANGLES/2);
    let r = Math.floor((Math.sqrt(x*x + y*y) - R0)
      / CELL_WIDTH);
    if (r < 0 || r >= NUM_RINGS) { return null; }
    if (th < 0 || th >= NUM_ANGLES) { throw 'Theta out of range??'; }
    return {th, r};
  }

  cellCenter({th, r}) {
    return {
        x: CENTER.x + (R0 + (r+0.5) * CELL_WIDTH) * Math.cos((th+.5) * CELL_ANGLE),
        y: CENTER.y + (R0 + (r+0.5) * CELL_WIDTH) * Math.sin((th+.5) * CELL_ANGLE),
    };
  }
};
