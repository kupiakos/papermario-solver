import MultiSet from 'mnemonist/multi-set';

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
export type FrameCallback = (amount: number) => void;
/** Called when an animation is finished executing. */
export type AnimationFinishedCallback = () => void;

/** An animation that has a certain length. */
export class Animation implements Animatable {
  /** The duration of the animation in seconds. */
  duration_sec: number;

  /** The time when the animation started. */
  private start_: number;

  /** The callback for each frame. */
  private onframe_: FrameCallback;

  /** The callback for when the animation finishes. */
  private onfinish_?: AnimationFinishedCallback;

  constructor(
    duration_sec: number,
    onframe: FrameCallback,
    onfinish?: AnimationFinishedCallback
  ) {
    if (duration_sec <= 0) {
      throw new RangeError('duration_sec ≤ 0');
    }
    this.duration_sec = duration_sec;
    this.onframe_ = onframe;
    this.onfinish_ = onfinish;
    this.start_ = 0;
  }

  /** Will the animation play on the next frame? */
  isPlaying(): boolean {
    return AnimationManager.getInstance().isScheduled(this);
  }

  /** Play the animation, changing the duration if desired. */
  play(duration_sec: number = this.duration_sec): void {
    if (duration_sec <= 0) {
      throw new RangeError('duration_sec ≤ 0');
    }
    this.duration_sec = duration_sec;
    this.start_ = performance.now();
    AnimationManager.getInstance().schedule(this);
  }

  /** Stop the animation. */
  stop(): void {
    AnimationManager.getInstance().unschedule(this);
    if (this.onfinish_) {
      this.onfinish_();
    }
  }

  /** Draw a frame at the given time. */
  drawFrame(t: number): boolean {
    const amount = (t - this.start_) / (this.duration_sec * 1000);
    let playOnNextFrame = true;
    try {
      this.onframe_(Math.min(Math.max(0, amount), 1));
    } finally {
      if (amount >= 1) {
        if (this.onfinish_) {
          this.onfinish_();
        }
        playOnNextFrame = false;
      }
    }
    return playOnNextFrame;
  }
}

/** Manages a set of animations. */
export class AnimationManager {
  private animationFrameId_: number | null;
  private playing_: MultiSet<Animatable>;
  private static instance_: AnimationManager;

  static getInstance(): AnimationManager {
    if (!this.instance_) {
      this.instance_ = new AnimationManager();
    }
    return this.instance_;
  }

  private constructor() {
    this.animationFrameId_ = null;
    this.playing_ = new MultiSet<Animatable>();
  }

  /** Schedule the animatable to play on the next frame. */
  schedule(a: Animatable) {
    this.playing_.add(a);
    this.startAnimating_();
  }

  /** Unschedule the animatable to prevent it playing on the next frame. */
  unschedule(a: Animatable) {
    this.playing_.delete(a);
  }

  /** Returns whether a given animatable will run on the next frame. */
  isScheduled(a: Animatable): boolean {
    return this.playing_.has(a);
  }

  /** Plays every animatable scheduled, unscheduling if requested. */
  private animationFrame_(t: number) {
    try {
      for (const a of Array.from(this.playing_)) {
        if (!a.drawFrame.call(a, t)) {
          this.playing_.remove(a);
        }
      }
    } catch (err) {
      this.playing_.clear();
      throw err;
    } finally {
      this.animationFrameId_ = null;
      if (this.playing_.size > 0) {
        this.animationFrameId_ = window.requestAnimationFrame(
          this.animationFrame_.bind(this)
        );
      }
    }
  }

  private startAnimating_() {
    if (this.animationFrameId_ === null) {
      this.animationFrameId_ = window.requestAnimationFrame(
        this.animationFrame_.bind(this)
      );
    }
  }

  private cancelAnimating_() {
    if (this.animationFrameId_ !== null) {
      window.cancelAnimationFrame(this.animationFrameId_);
      this.animationFrameId_ = null;
    }
  }
}
