export interface Animatable {
    drawFrame(t: number): boolean;
    isPlaying(): boolean;
    play(): void;
    stop(): void;
}
export declare type FrameCallback = (amount: number) => void;
export declare type AnimationFinishedCallback = () => void;
export declare class Animation implements Animatable {
    duration_sec: number;
    private start_;
    private onframe_;
    private onfinish_?;
    constructor(duration_sec: number, onframe: FrameCallback, onfinish?: AnimationFinishedCallback);
    isPlaying(): boolean;
    play(duration_sec?: number): void;
    stop(): void;
    drawFrame(t: number): boolean;
}
export declare class AnimationManager {
    private animationFrameId_;
    private playing_;
    private static instance_;
    static getInstance(): AnimationManager;
    private constructor();
    schedule(a: Animatable): void;
    unschedule(a: Animatable): void;
    isScheduled(a: Animatable): boolean;
    private animationFrame_;
    private startAnimating_;
    private cancelAnimating_;
}
