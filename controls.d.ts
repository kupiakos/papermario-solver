export declare type ControlState = 'moving' | 'choosing' | 'undo' | 'hidden';
export declare class Controls {
    private readonly controlsDisplay_;
    constructor(controlsDisplay: HTMLElement);
    setStates(states: ControlState[]): void;
}
