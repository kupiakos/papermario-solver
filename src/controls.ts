export type ControlState = 'moving' | 'choosing' | 'undo' | 'hidden';

export class Controls {
  private readonly controlsDisplay_: HTMLElement;
  constructor(controlsDisplay: HTMLElement) {
    this.controlsDisplay_ = controlsDisplay;
  }

  setStates(states: ControlState[]) {
    this.controlsDisplay_.setAttribute('states', states.join(' '));
  }
}
