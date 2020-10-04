/** An object that can be animated. */
export interface Animatable {
    /**
     * Draws a frame given the current time.
     * @param t The current time in seconds.
     * @returns Whether te re-call this Animatable on the next frame.
     */
    drawFrame(t: number): boolean;
    /**
     * Is this animation currently playing?
     * More precisely, has the last frame of this animation finished?
     */
    isPlaying(): boolean;
    /** Starts playing the animation. */
    play(): void;
    /** Stops playing the animation. */
    stop(): void;
}
/**
 * A callback called on each frame with the amount progressed through the
 * animation. amount is a number in the range [0, 1] that indicates how far
 * through the animation to draw.
 */
export declare type FrameCallback = (amount: number) => void;
/** Called when an animation is finished executing. */
export declare type AnimationFinishedCallback = () => void;
/** An animation that has a certain length. */
export declare class Animation implements Animatable {
    /** The duration of the animation in seconds. */
    duration_sec: number;
    /** The time when the animation started. */
    private start_;
    /** The callback for each frame. */
    private onframe_;
    /** The callback for when the animation finishes. */
    private onfinish_?;
    constructor(duration_sec: number, onframe: FrameCallback, onfinish?: AnimationFinishedCallback);
    /** Will the animation play on the next frame? */
    isPlaying(): boolean;
    /** Play the animation, changing the duration if desired. */
    play(duration_sec?: number): void;
    /** Stop the animation. */
    stop(): void;
    /** Draw a frame at the given time. */
    drawFrame(t: number): boolean;
}
/** Manages a set of animations. */
export declare class AnimationManager {
    private animationFrameId_;
    private playing_;
    private static instance_;
    static getInstance(): AnimationManager;
    private constructor();
    /** Schedule the animatable to play on the next frame. */
    schedule(a: Animatable): void;
    /** Unschedule the animatable to prevent it playing on the next frame. */
    unschedule(a: Animatable): void;
    /** Returns whether a given animatable will run on the next frame. */
    isScheduled(a: Animatable): boolean;
    /** Plays every animatable scheduled, unscheduling if requested. */
    private animationFrame_;
    private startAnimating_;
    private cancelAnimating_;
}
