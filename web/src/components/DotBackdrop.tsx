import { useEffect, useState } from "react";
import DotGrid from "../vendor/reactbits/DotGrid";

export default function DotBackdrop() {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setAnimated(
        !preference.matches &&
          !!document.createElement("canvas").getContext("webgl2"),
      );
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  return (
    <div
      className={`dot-backdrop ${animated ? "animated" : ""}`}
      aria-hidden="true"
    >
      {animated && (
        <DotGrid
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
