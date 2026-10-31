import {
  animate,
  type AnimationOptions,
  type AnimationPlaybackControlsWithThen,
  type DOMKeyframesDefinition,
} from "motion";

export const fade = { duration: 0.2, ease: "easeOut" } as const;
export const exit = { duration: 0.15, ease: "easeIn" } as const;
export const spring = (visualDuration: number): AnimationOptions => ({
  type: "spring",
  visualDuration,
  bounce: 0,
  opacity: fade,
  filter: fade,
});

// One controller owns both transitions and holds, so pausing freezes the whole story.
export function createPreviewPlayback() {
  const controls = new Set<AnimationPlaybackControlsWithThen>();
  let paused = false;
  let stopped = false;
  let speed = 1;
  const guard = () => {
    if (stopped) throw new DOMException("Preview stopped", "AbortError");
  };
  const track = (control: AnimationPlaybackControlsWithThen) => {
    if (speed !== 1) control.speed = speed;
    if (paused) control.pause();
    controls.add(control);
    control.then(() => controls.delete(control));
    return control;
  };
  const playback = {
    get stopped() {
      return stopped;
    },
    guard,
    animate(
      target: Element | Element[],
      frames: DOMKeyframesDefinition,
      options: AnimationOptions = {},
    ) {
      guard();
      return track(animate(target, frames, options));
    },
    async play(
      target: Element | Element[],
      frames: DOMKeyframesDefinition,
      options: AnimationOptions = {},
    ) {
      await playback.animate(target, frames, options);
      guard();
    },
    async wait(ms: number) {
      guard();
      await track(animate(0, 1, { duration: ms / 1000, ease: "linear" }));
      guard();
    },
    setPaused(next: boolean) {
      paused = next;
      controls.forEach((control) => (next ? control.pause() : control.play()));
    },
    setSpeed(next: number) {
      speed = next;
      controls.forEach((control) => (control.speed = speed));
    },
    stop() {
      stopped = true;
      controls.forEach((control) => control.stop());
      controls.clear();
    },
  };
  return playback;
}

export type PreviewPlayback = ReturnType<typeof createPreviewPlayback>;
export const query = <T extends Element = HTMLElement>(
  root: Element,
  selector: string,
) => root.querySelector<T>(selector)!;
