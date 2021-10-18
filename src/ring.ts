import {Animation} from './animation';
import {
  RingGroup,
  RingGroupType,
  RingMovement,
  isNegativeMovement,
} from './movement';
import {RingSettings} from './ring_settings';

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

const DEFAULT_R0 = 60;
const DEFAULT_CELL_WIDTH = 32;

const DEFAULT_NUM_RINGS = 4;
const DEFAULT_NUM_ANGLES = 12;
const DEFAULT_CELL_ANGLE = (2 * Math.PI) / DEFAULT_NUM_ANGLES;
const OUTSIDE_WIDTH = 40;

/** Different styles of animation for moving the ring. */
export enum AnimationMode {
  /** No animation will be done. */
  NONE = 0,

  /** Normal animation, for forwards movement. */
  NORMAL = 1,

  /** Fast animation, for quick undos. */
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

/** Gets the center of a cell for a given ring position. */
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

/** Gets the expected animation speed for a group type and animation mode. */
function animationSpeed(
  style: RingStyle,
  type: RingGroupType,
  animate: AnimationMode
): number {
  switch (animate) {
    case AnimationMode.NONE:
      return 0;
    case AnimationMode.NORMAL:
      return type === 'ring'
        ? style.move_styles.rotate.animation_time
        : style.move_styles.shift.animation_time;
    case AnimationMode.UNDO:
      return type === 'ring'
        ? style.move_styles.rotate.undo_animation_time
        : style.move_styles.shift.undo_animation_time;
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
function canvasesToLayers(frame: Size, canvases: Canvases): Layers {
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
    ctx.scale(canvas.width / frame.width, canvas.height / frame.height);
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
  style: ArcStyle;

  constructor(style: ArcStyle) {
    // this.fill_ = fill;
    this.hasEnemy = false;
    this.style = style;
  }

  /**
   * Draw the base of the cell, where the floor is.
   * @param ctx The context to draw on, expected to be the 'ring' layer.
   * @param pos The ring position to draw at. May be a non-integer.
   */
  drawBase(ctx: Context, pos: RingPosition) {
    ctx.strokeStyle = this.style.border;
    ctx.fillStyle = this.style.fill;
    ctx.lineWidth = this.style.border_width;
    this.basePath(ctx, pos);
    innerStroke(ctx);
  }

  /**
   * Draw the top of the cell, where the enemies are.
   * @param ctx The context to draw on, expected to be the 'enemy' layer.
   * @param pos The ring position to draw at. May be a non-integer.
   * @param enemy_style
   */
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
    const rStart = this.style.r0 + r * this.style.width;
    const rEnd = rStart + this.style.width;
    const thStart = th * (this.style.angle ?? Math.PI * 2);
    const thEnd = thStart + (this.style.angle ?? Math.PI * 2);
    filledArc(ctx, 0, 0, rStart, rEnd, thStart, thEnd);
  }
}

/** A dumb class that draws cells in the ring. */
class RingView {
  private readonly layers: Layers;
  private model_: RingModel;
  private settings: RingSettings;
  private style: RingStyle;

  /**
   * @param layers The set of Contexts to draw on.
   * @param model The {@link RingModel} that contains the cells.
   */
  constructor(
    layers: Layers,
    model: RingModel,
    style: RingStyle = DEFAULT_RING_STYLE
  ) {
    this.layers = layers;
    this.model_ = model;
    this.settings = model.settings;
    this.style = style;
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
      this.drawAngle(
        (group.th + this.settings.num_angles / 2) % this.settings.num_angles,
        -anim_amount
      );
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

  /** Draw the ring and its contents. */
  private drawRing() {
    // Ring cells
    for (let r = 0; r < this.settings.num_rings; ++r) {
      this.drawSubring(r);
    }
  }

  /** Draw the contents of the ring overlay. Should only need once. */
  private drawOverlay() {
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

  /** Get the layer associated with the layer name. */
  getLayer(layer_name: LayerName = 'ring'): Context {
    const layer = this.layers[layer_name];
    if (layer === undefined) {
      throw new ReferenceError(`No layer named ${layer_name}!`);
    }
    return layer;
  }
}

/** Contains the actual data stored on the ring, with manipulation code. */
export class RingModel {
  /** The actual contents of the model, hidden through abstraction. */
  readonly settings: RingSettings;
  // readonly style: RingStyle;
  private readonly ringContents_: Cell[];

  // TODO: properly separate styling from the model
  constructor(settings: RingSettings, style: RingStyle) {
    this.settings = settings;
    this.ringContents_ = [];
    const numCells = this.settings.num_angles * this.settings.num_rings;
    for (let i = 0; i < numCells; ++i) {
      const cellStyle =
        ((i % 2) + Math.floor(i / this.settings.num_angles)) % 2 === 0
          ? style.even_cell
          : style.odd_cell;
      this.ringContents_.push(new Cell(cellStyle));
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
    let start = r * this.settings.num_angles;
    let step = 1;
    let end = (r + 1) * this.settings.num_angles;
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
   * @param th The angular index to shift, [0, this.settings.num_angles).
   * @param outward Whether to shift outwards or inwards.
   */
  private shiftRow(th: number, outward: boolean) {
    if (th >= this.settings.num_angles / 2) {
      this.shiftRow(th - this.settings.num_angles / 2, !outward);
      return;
    }
    console.log('Shift row', th, outward ? 'outward' : 'inward');
    let start = th;
    let step = this.settings.num_angles;
    const numCells = this.settings.num_angles * this.settings.num_rings;
    let end = th + numCells;
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
    return this.ringContents_[
      (th % this.settings.num_angles) + r * this.settings.num_angles
    ];
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
  // TODO: get rid of the underscores on members?
  private settings: RingSettings;
  private style: RingStyle;

  constructor(canvases: Canvases, settings: RingSettings, style: RingStyle) {
    this.settings = settings;
    this.style = style;
    this.canvases_ = canvases;
    this.model_ = new RingModel(settings, style);
    this.view_ = new RingView(
      canvasesToLayers(style.frame, canvases),
      this.model_
    );
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
    this.model.move({...this.currentMovement_, amount: 1});
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
    this.animation_.play(animationSpeed(this.style, m.type, animate));
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
      x:
        (offsetPos.x / canvasSize.width) * this.style.frame.width -
        this.style.frame.width / 2,
      y:
        (offsetPos.y / canvasSize.height) * this.style.frame.height -
        this.style.frame.height / 2,
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
    cell.drawTop(ctx, pos, this.style.enemy_style);
  }
}
