
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
  private start: number;
  private onframe: FrameCallback;
  private onfinish?: AnimationFinishedCallback;

  constructor(
      duration_sec: number,
      onframe: FrameCallback,
      onfinish?: AnimationFinishedCallback) {
    if (duration_sec <= 0) {
      throw new RangeError('duration_sec ≤ 0');
    }
    this.duration_sec = duration_sec;
    this.onframe = onframe;
    this.onfinish = onfinish;
  }

  isPlaying(): boolean {
    return AnimationManager.getInstance().isScheduled(this);
  }

  play(duration_sec: number = this.duration_sec): void {
    if (duration_sec <= 0) {
      throw new RangeError('duration_sec ≤ 0');
    }
    this.duration_sec = duration_sec;
    this.start = performance.now();
    AnimationManager.getInstance().schedule(this);
  }

  stop(): void {
    AnimationManager.getInstance().unschedule(this);
    if (this.onfinish) {
      this.onfinish();
    }
  }

  drawFrame(t: number): boolean {
    let amount = (t - this.start) / (this.duration_sec * 1000);
    try {
      this.onframe(Math.min(Math.max(0, amount), 1));
    } finally {
      if (amount >= 1) {
        if (this.onfinish) {
          this.onfinish();
        }
        return false;
      }
    }
    return true;
  }
}

export class AnimationManager {
  private animation_frame_id: number | null;
  private playing: Set<Animatable>;
  private static instance: AnimationManager;

  static getInstance(): AnimationManager {
    if (!this.instance) {
      this.instance = new AnimationManager();
    }
    return this.instance;
  }

  private constructor() {
    this.animation_frame_id = null;
    this.playing = new Set<Animatable>();
  }

  schedule(a: Animatable) {
    this.playing.add(a);
    this.startAnimating();
  }

  unschedule(a: Animatable) {
    this.playing.delete(a);
  }

  isScheduled(a: Animatable): boolean {
    return this.playing.has(a);
  }

  private animationFrame(t: number) {
    try {
      for (let a of Array.from(this.playing)) {
        if (!a.drawFrame.call(a, t)) {
          this.playing.delete(a);
        }
      }
    } catch (err) {
      this.playing.clear();
      throw err;
    } finally {
      this.animation_frame_id = null;
      if (this.playing.size > 0) {
        this.animation_frame_id = window.requestAnimationFrame(
          this.animationFrame.bind(this));
      }
    }
  }

  private startAnimating() {
    if (this.animation_frame_id === null) {
      this.animation_frame_id = window.requestAnimationFrame(
        this.animationFrame.bind(this));
    }
  }

  cancelAnimating() {
    if (this.animation_frame_id !== null) {
      window.cancelAnimationFrame(this.animation_frame_id);
      this.animation_frame_id = null;
    }
  }
}

