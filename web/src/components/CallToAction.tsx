import { useEffect, useRef } from "react";
import { animate, type AnimationPlaybackControlsWithThen } from "motion";
import { DesignAsset } from "./DesignAsset";
import DotBackdrop from "./DotBackdrop";
import { Actions } from "./SiteChrome";

export default function CallToAction() {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = card.current!;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let rotation: AnimationPlaybackControlsWithThen | undefined;
    const reset = () => {
      if (preference.matches) {
        rotation?.stop();
        rotation = animate(node, { rotateX: 0, rotateY: 0 }, { duration: 0 });
        rotation.complete();
        node.style.transform = "none";
      } else
        rotation = animate(
          node,
          { rotateX: 0, rotateY: 0 },
          { type: "spring", visualDuration: 0.6, bounce: 0 },
        );
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const box = node.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      if (preference.matches) return;
      rotation = animate(
        node,
        {
          rotateX: -((y / box.height) * 2 - 1) * 3,
          rotateY: ((x / box.width) * 2 - 1) * 3,
        },
        { type: "spring", visualDuration: 0.5, bounce: 0 },
      );
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", reset);
    preference.addEventListener("change", reset);
    return () => {
      rotation?.stop();
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", reset);
      preference.removeEventListener("change", reset);
    };
  }, []);
  return (
    <div ref={card} className="cta-card">
      <DotBackdrop />
      <DesignAsset section="36844" name="imgEllipse" className="cta-glow" />
      <div className="cta-content">
        <h2 id="cta-title">
          Less friction.
          <br />
          More forward.
        </h2>
        <p>Start with a simpler approach to secrets.</p>
        <Actions />
      </div>
    </div>
  );
}
