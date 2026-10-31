import { useEffect, useState } from "react";
import DotGrid from "../vendor/reactbits/DotGrid";

export default function DotBackdrop({ onReady }: { onReady?: () => void }) {
  const [animated, setAnimated] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReady(false);
      setAnimated(!preference.matches);
      if (preference.matches) onReady?.();
    };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, [onReady]);
  return (
    <div
      className={`dot-backdrop ${animated && ready ? "animated" : ""}`}
      aria-hidden="true"
    >
      {animated && (
        <DotGrid
          onReady={(rendered) => {
            setReady(rendered);
            onReady?.();
          }}
          dotSize={3}
          gap={22}
          baseColor="#dcdee3"
          activeColor="#2f5aba"
          proximity={120}
          shockStrength={2}
          glow={0.2}
        />
      )}
    </div>
  );
}
