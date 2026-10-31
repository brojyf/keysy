import { useCallback, useState } from "react";
import { DesignAsset } from "./DesignAsset";
import DotBackdrop from "./DotBackdrop";
import { Actions } from "./SiteChrome";
import ProductWindow from "./previews/ProductWindow";

export default function Hero() {
  const [ready, setReady] = useState(false);
  const start = useCallback(() => setReady(true), []);

  return (
    <>
      <DotBackdrop onReady={start} />
      <DesignAsset loading="eager" section="36008" name="imgGlowBlue" className="hero-glow blue" />
      <DesignAsset loading="eager" section="36008" name="imgGlowSky" className="hero-glow sky" />
      <DesignAsset loading="eager" section="36008" name="imgGlowPeriwinkle" className="hero-glow periwinkle" />
      <div className="section-inner">
        <p className="hero-badge">
          <DesignAsset loading="eager" section="36008" name="imgEllipse" />
          AI-assisted secret management · Coming soon
        </p>
        <h1 id="hero-title">Your secrets.<br /><span>Simply managed.</span></h1>
        <p className="hero-description">
          A calmer way to manage secrets for local development and deployed
          services. AI keeps access policies right as things move.
        </p>
        <Actions />
        <ProductWindow ready={ready} />
      </div>
    </>
  );
}
