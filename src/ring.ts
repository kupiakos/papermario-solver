import {Animation} from './animation';
import {
  RingGroup,
  RingGroupType,
  RingMovement,
  isNegativeMovement,
} from './movement';

type Context = CanvasRenderingContext2D;

/**
 * To make drawing simpler, the canvases for drawing parts of the board are
 * done in layers. These are their names.
 * In order from top to bottom:
 *  - overlay: The inner and outer borders, hides a lot of visual artifacts.
 *  - enemy:   Where enemies are drawn.
 *  - cursor:  Where the cursor (only on desktop) is drawn.
 *  - ring:    Where the actual cells of the ring itself are drawn.
 */
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
export const R0 = 60;

/**
 * The radial width of each cell/subring.
 */
export const CELL_WIDTH = 32;

/** The number of rings in the puzzle. */
export const NUM_RINGS = 4;

/** The number of different angles (i.e. "jumps") in the puzzle. */
export const NUM_ANGLES = 12;
if (NUM_ANGLES % 2 !== 0) {
  throw new RangeError('NUM_ANGLES not even!');
}

/** The total number of cells, derived. */
export const NUM_CELLS = NUM_RINGS * NUM_ANGLES;

/** The angle, in radians, each cell takes up. */
export const CELL_ANGLE = (2 * Math.PI) / NUM_ANGLES;
export const OUTSIDE_WIDTH = 40;

/** The size of the logical container for the ring. */
export const FRAME: Size = {
  width: (R0 + NUM_RINGS * CELL_WIDTH + OUTSIDE_WIDTH) * 2,
  height: (R0 + NUM_RINGS * CELL_WIDTH + OUTSIDE_WIDTH) * 2,
};

/** Different styles of animation for moving the ring. */
export enum AnimationMode {
  /** No animation will be done. */
  NONE = 0,

  /** Normal animation, for forwards movement. */
  NORMAL = 1,

  /** Fast animation, for quick undos. */
  UNDO = 2,
}

/** The time, in seconds, for a ring to rotate one unit. */
const RING_ROTATE_ANIMATION_TIME = 0.15;

/** The time, in seconds, for a ring to rotate one unit when undoing. */
const RING_UNDO_ROTATE_ANIMATION_TIME = 0.05;

/** The time, in seconds, for a row to shift one unit. */
const RING_SHIFT_ANIMATION_TIME = 0.2;

/** The time, in seconds, for a row to shift one unit when undoing. */
const RING_UNDO_SHIFT_ANIMATION_TIME = 0.08;

/** The fill color of the lighter cells. */
const CELL1_FILL = '#ada786';
/** The fill color of the darker cells. */
const CELL2_FILL = '#8f8a6d';
/** The border color of each cell. */
const CELL_BORDER = 'black';
const CELL_BORDER_WIDTH = 0.8;

/** The fill color for the inside ring. */
const INSIDE_FILL = '#a64250';
/** The border color for the inside ring. */
const INSIDE_BORDER = '#bf7e56';
/** The width of the border of the inside ring. */
const INSIDE_BORDER_WIDTH = 6;

/** The fill color for the outside ring. */
const OUTSIDE_FILL = '#5AE67C';
/** The border color for the outside ring. */
const OUTSIDE_BORDER = '#99851A';
/** The width of the border of the outside ring. */
const OUTSIDE_BORDER_WIDTH = 6;

const ENEMY_COLOR = '#ee0';
const ENEMY_RADIUS = 9;

/** Gets the center of a cell for a given ring position. */
function cellCenter({th, r}: RingPosition) {
  return {
    x: (R0 + (r + 0.5) * CELL_WIDTH) * Math.cos((th + 0.5) * CELL_ANGLE),
    y: (R0 + (r + 0.5) * CELL_WIDTH) * Math.sin((th + 0.5) * CELL_ANGLE),
  };
}

/** Gets the expected animation speed for a group type and animation mode. */
function animationSpeed(type: RingGroupType, animate: AnimationMode): number {
  switch (animate) {
    case AnimationMode.NONE:
      return 0;
    case AnimationMode.NORMAL:
      return type === 'ring'
        ? RING_ROTATE_ANIMATION_TIME
        : RING_SHIFT_ANIMATION_TIME;
    case AnimationMode.UNDO:
      return type === 'ring'
        ? RING_UNDO_ROTATE_ANIMATION_TIME
        : RING_UNDO_SHIFT_ANIMATION_TIME;
  }
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

/**
 * Like ctx.stroke, but only on the inner part of a path, so it doesn't go
 * outside. See https://stackoverflow.com/a/45125187.
 * @param ctx The context to manipulate.
 */
function innerStroke(ctx: Context) {
  ctx.save();
  ctx.clip();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Gets the contexts for a set of canvases, verifying important properties.
 * @param canvases The set of canvases to convert.
 */
function canvasesToLayers(canvases: Canvases): Layers {
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
  return layers;
}

/**
 * Stores the data necessary to draw and manipulate a single cell on a ring.
 * Notably, this doesn't contain the actual position of the cell. That's done
 * by the model itelf.
 */
class Cell {
  /** Does this cell currently contain an enemy? */
  hasEnemy: boolean;

  /** The fill style of the cell, used for drawing. */
  private readonly fill_: string;

  constructor(fill: string) {
    this.fill_ = fill;
    this.hasEnemy = false;
  }

  /**
   * Draw the base of the cell, where the floor is.
   * @param ctx The context to draw on, expected to be the 'ring' layer.
   * @param pos The ring position to draw at. May be a non-integer.
   */
  drawBase(ctx: Context, pos: RingPosition) {
    ctx.strokeStyle = CELL_BORDER;
    ctx.fillStyle = this.fill_;
    ctx.lineWidth = CELL_BORDER_WIDTH;
    this.basePath(ctx, pos);
    innerStroke(ctx);
  }

  /**
   * Draw the top of the cell, where the enemies are.
   * @param ctx The context to draw on, expected to be the 'enemy' layer.
   * @param pos The ring position to draw at. May be a non-integer.
   */
  drawTop(ctx: Context, {th, r}: RingPosition) {
    if (this.hasEnemy) {
      ctx.fillStyle = ENEMY_COLOR;
      const dotCenter = cellCenter({th, r});
      ctx.moveTo(dotCenter.x, dotCenter.y);
      ctx.beginPath();
      ctx.arc(dotCenter.x, dotCenter.y, ENEMY_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  /**
   * Clear the top of the cell, where the enemies are.
   * @param ctx The context to draw on, expected to be the 'enemy' layer.
   * @param pos The ring position to clear.
   */
  clearTop(ctx: Context, pos: RingPosition) {
    ctx.save();
    ctx.fillStyle = 'black';
    ctx.globalCompositeOperation = 'destination-out';
    this.basePath(ctx, pos);
    ctx.fill();
    ctx.restore();
  }

  /** Paths out the actual base of the cell, for clearing or drawing. */
  private basePath(ctx: Context, {th, r}: RingPosition) {
    ctx.moveTo(0, 0);
    ctx.beginPath();
    const rStart = R0 + r * CELL_WIDTH;
    const rEnd = rStart + CELL_WIDTH;
    const thStart = th * CELL_ANGLE;
    const thEnd = thStart + CELL_ANGLE;
    filledArc(ctx, 0, 0, rStart, rEnd, thStart, thEnd);
  }
}

/** A dumb class that draws cells in the ring. */
class RingView {
  private readonly layers_: Layers;
  private model_: RingModel;

  /**
   * @param layers The set of Contexts to draw on.
   * @param model The {@link RingModel} that contains the cells.
   */
  constructor(layers: Layers, model: RingModel) {
    this.layers_ = layers;
    this.model_ = model;
  }

  /** Draw the whole ring, including the background. */
  draw() {
    this.drawRing();
    this.drawOverlay();
  }

  /**
   * Draws a specific subring or row, possibly currently animated.
   * @param group The subring/row.
   * @param anim_amount The amount we're currently through an animation,
   * in the range [-1, 1]. See {@link drawSubring}, {@link drawAngle}.
   */
  drawGroup(group: RingGroup, anim_amount = 0) {
    if (group.type === 'ring') {
      this.drawSubring(group.r, anim_amount);
    } else {
      this.drawAngle(group.th, anim_amount);
      this.drawAngle((group.th + NUM_ANGLES / 2) % NUM_ANGLES, -anim_amount);
    }
  }

  /** Get the cell at a given position. */
  private getCell(pos: RingPosition): Cell {
    return this.model_.getCell(pos);
  }

  /**
   * Draws a specific subring, possibly currently animated.
   *
   * An anim_amount of 0 draws the subring as the model says.
   * Lower values are drawn rotated anticlockwise, and higher amounts are drawn
   * rotated clockwise.
   * @param r The radius index of the subring.
   * @param anim_amount The animation amount, in the range [-1, 1].
   */
  private drawSubring(r: number, anim_amount = 0) {
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

  /**
   * Draws a specific angle/half-row, possibly currently animated.
   *
   * An anim_amount of 0 draws the subring as the model says.
   * Lower values are drawn shifted inwards, and higher amounts are drawn
   * shifted outwards.
   * @param th The angular index (theta) of the subring.
   * @param anim_amount The animation amount, in the range [-1, 1].
   */
  private drawAngle(th: number, anim_amount = 0) {
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

  /** Draw the ring and its contents. */
  private drawRing() {
    // Ring cells
    for (let r = 0; r < NUM_RINGS; ++r) {
      this.drawSubring(r);
    }
  }

  /** Draw the contents of the ring overlay. Should only need once. */
  private drawOverlay() {
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

  /** Get the layer associated with the layer name. */
  getLayer(layer_name: LayerName = 'ring'): Context {
    const layer = this.layers_[layer_name];
    if (layer === undefined) {
      throw new ReferenceError(`No layer named ${layer_name}!`);
    }
    return layer;
  }
}

/** Contains the actual data stored on the ring, with manipulation code. */
export class RingModel {
  /** The actual contents of the model, hidden through abstraction. */
  private readonly ringContents_: Cell[];

  constructor() {
    this.ringContents_ = [];
    for (let i = 0; i < NUM_CELLS; ++i) {
      const color =
        ((i % 2) + Math.floor(i / NUM_ANGLES)) % 2 === 0
          ? CELL1_FILL
          : CELL2_FILL;
      this.ringContents_.push(new Cell(color));
    }
  }

  /**
   * Manipulate the ring contents, either a row shift or subring rotate.
   * @param m The ring movement to do.
   */
  move(m: RingMovement) {
    if (m.amount < 0) {
      throw new RangeError(`move amount ${m.amount} < 0`);
    }
    for (let i = 0; i < m.amount; ++i) {
      if (m.type === 'ring') {
        this.rotateRing(m.r, m.clockwise);
      } else {
        this.shiftRow(m.th, m.outward);
      }
    }
  }

  /**
   * Rotate a subring once.
   * @param r The subring index to rotate.
   * @param clockwise Whether to rotate the ring clockwise.
   */
  private rotateRing(r: number, clockwise: boolean) {
    console.log('Rotate ring', r, clockwise ? 'clockwise' : 'anti-clockwise');
    let start = r * NUM_ANGLES;
    let step = 1;
    let end = (r + 1) * NUM_ANGLES;
    const arr = this.ringContents_;
    if (clockwise) {
      step = -step;
      [start, end] = [end + step, start + step];
    }
    for (let i = start; i !== end - step; i += step) {
      [arr[i], arr[i + step]] = [arr[i + step], arr[i]];
    }
  }

  /**
   * Shift a given row once.
   * @param th The angular index to shift, [0, NUM_ANGLES).
   * @param outward Whether to shift outwards or inwards.
   */
  private shiftRow(th: number, outward: boolean) {
    if (th >= NUM_ANGLES / 2) {
      this.shiftRow(th - NUM_ANGLES / 2, !outward);
      return;
    }
    console.log('Shift row', th, outward ? 'outward' : 'inward');
    let start = th;
    let step = NUM_ANGLES;
    let end = th + NUM_CELLS;
    if (outward) {
      start += step / 2;
      end += step / 2;
    }
    const arr = this.ringContents_;
    if ((end - start) % step !== 0) {
      throw new RangeError('wtf');
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

  getCell({th, r}: RingPosition) {
    if (th < 0 || th >= NUM_ANGLES || r < 0 || r >= NUM_RINGS) {
      throw new RangeError(`Cell index out of range: {th: ${th}, r: ${r}}}`);
    }
    return this.ringContents_[(th % NUM_ANGLES) + r * NUM_ANGLES];
  }
}

/**
 * Represents the user-visible ring and tools to manipulate it.
 * This is the really important class.
 */
export class Ring {
  private readonly canvases_: Canvases;
  private readonly model_: RingModel;
  private readonly view_: RingView;
  private currentMovement_: RingMovement | null = null;
  private readonly animation_: Animation;
  private readyCallbacks_: {(): void}[] = [];

  constructor(canvases: Canvases) {
    this.canvases_ = canvases;
    this.model_ = new RingModel();
    this.view_ = new RingView(canvasesToLayers(canvases), this.model_);
    this.animation_ = new Animation(
      1,
      this.onFrame.bind(this),
      this.onSingleMoveDone.bind(this)
    );
  }

  get model(): RingModel {
    return this.model_;
  }

  get view(): RingView {
    return this.view_;
  }

  /**
   * Called on each frame of a move animation.
   * @param amount The progress through the animation to draw, [0, 1].
   */
  private onFrame(amount: number) {
    if (!this.currentMovement_) {
      throw new ReferenceError('Last movement null?');
    }
    if (isNegativeMovement(this.currentMovement_)) {
      amount = -amount;
    }
    this.view.drawGroup(this.currentMovement_, amount);
  }

  /** Executed when an animation has finished for a single movement. */
  private onSingleMoveDone() {
    if (!this.currentMovement_) {
      throw new ReferenceError('Last movement null?');
    }
    this.model.move(this.currentMovement_);
    if (--this.currentMovement_.amount > 0) {
      // We're not done moving yet, replay the animation.
      this.animation_.play();
    } else {
      this.currentMovement_ = null;
      while (this.readyCallbacks_.length > 0) {
        const cb = this.readyCallbacks_.shift();
        if (!cb) {
          throw new ReferenceError('cb null???');
        }
        cb();
        if (this.currentMovement_ !== null) {
          // This callback started a new movement.
          break;
        }
      }
    }
  }

  /** Is the ring currently busy being animated? */
  isBusy(): boolean {
    return this.animation_.isPlaying();
  }

  /** Returns a promise that resolves when the animation is done playing. */
  async waitUntilReady(): Promise<void> {
    if (!this.isBusy()) {
      return Promise.resolve();
    }
    return new Promise(resolve => this.readyCallbacks_.push(resolve));
  }

  /** Animates a movement, returning a promise that resolves when it's done. */
  async animateMove(
    m: RingMovement,
    animate: AnimationMode = AnimationMode.NORMAL
  ): Promise<void> {
    await this.waitUntilReady();
    if (animate === AnimationMode.NONE) {
      this.model.move(m);
      return;
    }
    this.currentMovement_ = {...m};
    this.animation_.play(animationSpeed(m.type, animate));
    await this.waitUntilReady();
  }

  /**
   * Draws a specific subring or row.
   * @param group The subring/row.
   */
  drawGroup(group: RingGroup) {
    this.view.drawGroup(group, 0);
  }

  /**
   * Converts from a canvas offset to the equivalent in the drawing frame.
   * @param offsetPos.x The canvas.offsetX
   * @param offsetPos.y The canvas.offsetY
   * @returns The equivalent (X, Y) point in the frame, with a (0,0) center.
   */
  private offsetToFramePos(offsetPos: Point): Point {
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

  /**
   * Converts from a canvas offset to a ring position.
   * @param offsetPos.x The canvas.offsetX
   * @param offsetPos.y The canvas.offsetY
   * @returns The equivalent position in the ring, or null if there is none.
   */
  private offsetToRingPos(offsetPos: Point): RingPosition | null {
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

  /** Run every time a mouse click or touch happens. */
  onMouseDown(event: MouseEvent) {
    const pos = this.offsetToRingPos({x: event.offsetX, y: event.offsetY});
    if (!pos) {
      return;
    }
    console.log('click', pos);
    const ctx = this.view.getLayer('enemy');
    const cell = this.model.getCell(pos);
    cell.hasEnemy = !cell.hasEnemy;
    cell.clearTop(ctx, pos);
    cell.drawTop(ctx, pos);
  }
}
