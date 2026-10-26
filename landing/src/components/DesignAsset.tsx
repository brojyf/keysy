import assets from "./design-assets.json";

export function DesignAsset({
  section,
  name,
  className = "",
}: {
  section: keyof typeof assets;
  name: string;
  className?: string;
}) {
  const asset = (
    assets[section] as Record<
      string,
      { file: string; width: number; height: number }
    >
  )[name];
  return (
    <img
      className={className}
      src={`/design/${asset.file}`}
      width={asset.width}
      height={asset.height}
      alt=""
      aria-hidden="true"
    />
  );
}
