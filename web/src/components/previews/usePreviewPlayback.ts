import { useEffect, useRef, useState, type RefObject } from "react";
import { createPreviewPlayback, type PreviewPlayback } from "./previewPlayback";

export function usePreviewPlayback(
  scope: RefObject<HTMLDivElement | null>,
  story: (run: PreviewPlayback, root: HTMLElement) => Promise<void>,
  renderFinal: (root: HTMLElement) => void,
  loop: boolean,
) {
  const [playing, setPlaying] = useState(true);
  const [active, setActive] = useState(false);
  const [reduced, setReduced] = useState(false);
  const toggleRef = useRef(() => {});

  useEffect(() => {
    const root = scope.current!;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let run: PreviewPlayback | undefined;
    let userPlaying = true;
    let visible = true;
    let completed = false;
    const syncPlayback = () => {
      const enabled =
        userPlaying && !preference.matches && visible && !document.hidden;
      setActive(enabled);
      run?.setPaused(!enabled);
    };
    const start = () => {
      run?.stop();
      setReduced(preference.matches);
      if (completed && !loop) {
        renderFinal(root);
        syncPlayback();
        return;
      }
      userPlaying = !preference.matches;
      setPlaying(userPlaying);
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
              completed = true;
              userPlaying = false;
              current.stop();
              renderFinal(root);
              setPlaying(false);
              syncPlayback();
              break;
            }
          }
        } catch (error) {
          if (!current.stopped) throw error;
        }
      })();
    };
    toggleRef.current = () => {
      if (preference.matches) return;
      userPlaying = !userPlaying;
      setPlaying(userPlaying);
      syncPlayback();
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
      toggleRef.current = () => {};
    };
  }, [scope, story, renderFinal, loop]);

  return { playing, active, reduced, toggle: () => toggleRef.current() };
}
