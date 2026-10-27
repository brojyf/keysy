import type { ReactNode } from "react";
import { DesignAsset } from "./DesignAsset";

// The dark terminal shared by the hero preview and the workflow section.
export function TerminalWindow({
  className,
  folder,
  decorative = false,
  eager = false,
  children,
}: {
  className: string;
  folder: string;
  decorative?: boolean;
  eager?: boolean;
  children: ReactNode;
}) {
  const loading = eager ? "eager" : "lazy";
  return (
    <div
      className={`terminal-window ${className}`}
      aria-hidden={decorative || undefined}
    >
      <div className="terminal-bar">
        <span className="terminal-lights">
          {["imgEllipse1", "imgEllipse2", "imgEllipse3"].map((name) => (
            <DesignAsset
              key={name}
              section="36776"
              name={name}
              loading={loading}
            />
          ))}
        </span>
        <span className="terminal-title">
          <DesignAsset section="36776" name="imgFolderIcon" loading={loading} />
          {`${folder} — -zsh — 80×24`}
        </span>
      </div>
      {children}
    </div>
  );
}

export function TerminalPrompt({ folder }: { folder: string }) {
  return <span className="terminal-accent">{`alice@mbp ${folder} % `}</span>;
}
