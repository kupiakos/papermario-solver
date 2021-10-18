import {RingSettings} from './ring_settings';

export type RingSubring = {type: 'ring'; r: number};
export type RingRow = {type: 'row'; th: number};
export type RingGroupType = 'ring' | 'row';
export type RingGroup = RingSubring | RingRow;

export type RingRotate = RingSubring & {clockwise: boolean; amount: number};
export type RingShift = RingRow & {outward: boolean; amount: number};
export type RingMovement = RingRotate | RingShift;

export function simplifyMovement(
  m: RingMovement,
  settings: RingSettings
): RingMovement {
  if (m.type === 'ring') {
    if (m.amount <= 0) {
      return {...m, amount: -m.amount, clockwise: !m.clockwise};
    }
    const amount = m.amount % settings.num_angles;
    if (amount > settings.num_angles / 2) {
      return {
        ...m,
        amount: settings.num_angles - amount,
        clockwise: !m.clockwise,
      };
    }
    return {...m, amount};
  }
  if (m.amount <= 0) {
    return {...m, amount: -m.amount, outward: !m.outward};
  }
  const amount = m.amount % (settings.num_rings * 2);
  if (amount > settings.num_rings) {
    return {...m, amount: settings.num_rings * 2 - amount, outward: !m.outward};
  }
  return {...m, amount};
}

/**
 * Combine two movements of the same type.
 * @param m1 The first movement, or null if none.
 * @param m2 The second movement.
 * @returns The combined movement, or null if no movement.
 * @throws If the movements are not of the same type.
 */
export function combineMovements(
  m1: RingMovement | null,
  m2: RingMovement,
  settings: RingSettings
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
    return simplifyMovement(
      {
        type: 'ring',
        amount: Math.abs(amount),
        clockwise: amount > 0,
        r: m1.r,
      },
      settings
    );
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
    return simplifyMovement(
      {
        type: 'row',
        amount: Math.abs(amount),
        outward: amount > 0,
        th: m1.th,
      },
      settings
    );
  }
  throw new Error('Cannot combine incompatible movements');
}

/**
 * Reverses a movement.
 * combineMovements(m, reverseMovement(m)) === null for every m.
 * @param m The movement to reverse.
 */
export function reverseMovement(m: RingMovement): RingMovement {
  if (m.type === 'ring') {
    return {...m, clockwise: !m.clockwise};
  } else {
    return {...m, outward: !m.outward};
  }
}

/**
 * Returns whether the movement is considered "negative" for the
 * purposes of animation.
 */
export function isNegativeMovement(m: RingMovement): boolean {
  return (
    (m.type === 'ring' && !m.clockwise) || (m.type === 'row' && !m.outward)
  );
}

/**
 * Keeps track of multiple movements and move history for a ring.
 */
export class MoveHistory {
  private moves_: (RingMovement | null)[];
  private readonly ringMovesDisplay_: HTMLElement;

  constructor(ringMovesDisplay: HTMLElement) {
    this.ringMovesDisplay_ = ringMovesDisplay;
    this.moves_ = [];
  }

  addMovement(m: RingMovement | null) {
    this.moves_.push(m);
    this.updateDisplay();
  }

  get empty(): boolean {
    return this.moves_.length === 0;
  }

  // Precondition: !empty
  popMovement(): RingMovement | null {
    const m = this.moves_.pop();
    if (m === undefined) {
      throw Error('No movements to pop');
    }
    this.updateDisplay();
    return m;
  }

  private updateDisplay() {
    this.ringMovesDisplay_.innerText = '×' + this.moves_.length;
  }
}
