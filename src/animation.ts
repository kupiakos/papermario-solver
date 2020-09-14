export interface Animatable {
  // Draws the frame given the current time t.
  // Returns whether to recall this Animatable on the next frame.
  drawFrame(t: number): boolean;

  // Is this animation currently playing?
  // More precisely, has the last frame of this animation finished?
  isPlaying(): boolean;

  // Starts playing the animation.
  play(): void;

  // Stops playing the animation.
  stop(): void;
}

// A callback called on each frame with the amount
// progressed through the animation. amount is a number
// in the range [0, 1] that indicates how far through the
// animation to draw.
export type FrameCallback = (amount: number) => void;
export type AnimationFinishedCallback = () => void;
export class Animation implements Animatable {
  duration_sec: number;
  private start_: number;
  private onframe_: FrameCallback;
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

  isPlaying(): boolean {
    return AnimationManager.getInstance().isScheduled(this);
  }

  play(duration_sec: number = this.duration_sec): void {
    if (duration_sec <= 0) {
      throw new RangeError('duration_sec ≤ 0');
    }
    this.duration_sec = duration_sec;
    this.start_ = performance.now();
    AnimationManager.getInstance().schedule(this);
  }

  stop(): void {
    AnimationManager.getInstance().unschedule(this);
    if (this.onfinish_) {
      this.onfinish_();
    }
  }

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

export class AnimationManager {
  private animationFrameId_: number | null;
  private playing_: Set<Animatable>;
  private static instance_: AnimationManager;

  static getInstance(): AnimationManager {
    if (!this.instance_) {
      this.instance_ = new AnimationManager();
    }
    return this.instance_;
  }

  private constructor() {
    this.animationFrameId_ = null;
    this.playing_ = new Set<Animatable>();
  }

  schedule(a: Animatable) {
    this.playing_.add(a);
    this.startAnimating_();
  }

  unschedule(a: Animatable) {
    this.playing_.delete(a);
  }

  isScheduled(a: Animatable): boolean {
    return this.playing_.has(a);
  }

  private animationFrame_(t: number) {
    try {
      for (const a of Array.from(this.playing_)) {
        if (!a.drawFrame.call(a, t)) {
          this.playing_.delete(a);
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
