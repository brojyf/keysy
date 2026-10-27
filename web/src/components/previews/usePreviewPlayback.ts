import { useEffect, useState, type RefObject } from "react";
import { createPreviewPlayback, type PreviewPlayback } from "./previewPlayback";

export function usePreviewPlayback(
  scope: RefObject<HTMLDivElement | null>,
  story: (run: PreviewPlayback, root: HTMLElement) => Promise<void>,
  renderFinal: (root: HTMLElement) => void,
  loop: boolean,
) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const root = scope.current!;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let run: PreviewPlayback | undefined;
    let playing = true;
    let visible = true;
    let completed = false;
    const syncPlayback = () => {
      const enabled =
        playing && !preference.matches && visible && !document.hidden;
      setActive(enabled);
      run?.setPaused(!enabled);
    };
    const start = () => {
      run?.stop();
      if (completed && !loop) {
        renderFinal(root);
        syncPlayback();
        return;
      }
      playing = !preference.matches;
      if (preference.matches) {
        if (!loop) completed = true;
        renderFinal(root);
        syncPlayback();
        return;
      }
      const current = createPreviewPlayback();
      run = current;
      syncPlayback();
      void (async () => {
        try {
          while (!current.stopped) {
            await story(current, root);
            current.guard();
            if (!loop) {
              // The story already ends on its final frame; redrawing it would make it jump.
              completed = true;
              playing = false;
              current.stop();
              syncPlayback();
              break;
            }
          }
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
      observer?.disconnect();
      preference.removeEventListener("change", start);
      document.removeEventListener("visibilitychange", syncPlayback);
    };
  }, [scope, story, renderFinal, loop]);

  return { active };
}
