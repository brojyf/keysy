import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { DesignAsset } from "../DesignAsset";
import { prompt } from "./previewContent";

export default function HeroAssistant({
  orbState,
  active,
}: {
  orbState: OrbState | null;
  active: boolean;
}) {
  return (
    <>
      <strong>
        <DesignAsset loading="eager" section="36008" name="imgIconSparkle" />
        AI assistant
      </strong>
      <div className="assistant-thread" aria-hidden="true">
        <p className="assistant-prompt">{prompt}</p>
        <div className="thinking" hidden>
          {/* Mounted up front: mounting it mid-entrance pushed the phrase aside and
              flashed the orb's first frames. It idles, paused, until the AI thinks. */}
          <ThinkingOrb
            state={orbState ?? "searching"}
            size={20}
            color="#1d4ed8"
            theme="light"
            paused={!active || !orbState}
            aria-hidden="true"
          />
          <span className="thinking-text">Finding affected policies…</span>
        </div>
        <div className="assistant-reply">
          <p>Done. I moved 2 secrets and updated the policies that use them.</p>
          <div>
            {[
              "2 secrets moved",
              "2 policies updated",
              "Permissions verified",
            ].map((text, i) => (
              <p key={text}>
                <DesignAsset
                  loading="eager"
                  section="36008"
                  name={`imgIcon${i + 5}`}
                />
                {text}
              </p>
            ))}
          </div>
          <span>View changes →</span>
        </div>
      </div>
      <div className="assistant-input">
        <span className="composer-text" />
        <b>↑</b>
      </div>
    </>
  );
}
