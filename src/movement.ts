import {NUM_ANGLES, NUM_RINGS} from './ring';

export type RingSubring = {type: 'ring'; r: number};
export type RingRow = {type: 'row'; th: number};
export type RingGroupType = 'ring' | 'row';
export type RingGroup = RingSubring | RingRow;

export type RingRotate = RingSubring & {clockwise: boolean; amount: number};
export type RingShift = RingRow & {outward: boolean; amount: number};
export type RingMovement = RingRotate | RingShift;

export function simplifyMovement(m: RingMovement): RingMovement {
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
    return {...m, amount: NUM_RINGS * 2 - amount, outward: !m.outward};
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
