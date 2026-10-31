import { useEffect, useState, type RefObject } from "react";
import { frame } from "motion";
import { createPreviewPlayback, type PreviewPlayback } from "./previewPlayback";

export function usePreviewPlayback(
  scope: RefObject<HTMLDivElement | null>,
  story: (run: PreviewPlayback, root: HTMLElement) => Promise<void>,
  renderFinal: (root: HTMLElement) => void,
  renderFinalOnComplete = false,
  ready = true,
) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!ready) {
      setActive(false);
      return;
    }
    const root = scope.current!;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let run: PreviewPlayback | undefined;
    let deadline: PreviewPlayback | undefined;
    let playing = true;
    let visible = true;
    let completed = false;
    const syncPlayback = () => {
      const enabled =
        playing && !preference.matches && visible && !document.hidden;
      setActive(enabled);
      run?.setPaused(!enabled);
      deadline?.setPaused(!enabled);
    };
    const start = () => {
      run?.stop();
      deadline?.stop();
      if (completed) {
        renderFinal(root);
        syncPlayback();
        return;
      }
      playing = !preference.matches;
      if (preference.matches) {
        completed = true;
        renderFinal(root);
        syncPlayback();
        return;
      }
      const current = createPreviewPlayback();
      // The deadline has its own clock so story playback speed cannot change it.
      const currentDeadline = createPreviewPlayback();
      run = current;
      deadline = currentDeadline;
      syncPlayback();
      void (async () => {
        try {
          const timedOut = await Promise.race([
            story(current, root).then(() => false),
            currentDeadline.wait(4800).then(() => true),
          ]);
          currentDeadline.stop();
          current.guard();
          completed = true;
          playing = false;
          current.stop();
          // Motion flushes sampled styles on its next render step.
          if (renderFinalOnComplete || timedOut)
            frame.postRender(() => {
              if (scope.current === root) renderFinal(root);
            });
          syncPlayback();
        } catch (error) {
          if (!current.stopped) throw error;
        }
      })();
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            syncPlayback();
          });
    observer?.observe(root);
    preference.addEventListener("change", start);
    document.addEventListener("visibilitychange", syncPlayback);
    start();
    return () => {
      run?.stop();
      deadline?.stop();
      observer?.disconnect();
      preference.removeEventListener("change", start);
      document.removeEventListener("visibilitychange", syncPlayback);
    };
  }, [scope, story, renderFinal, renderFinalOnComplete, ready]);

  return { active };
}
