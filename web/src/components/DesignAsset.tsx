import assets from "./design-assets.json";

export function DesignAsset({
  section,
  name,
  className = "",
  loading = "lazy",
}: {
  section: keyof typeof assets;
  name: string;
  className?: string;
  loading?: "lazy" | "eager";
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
      loading={loading}
      decoding="async"
      aria-hidden="true"
    />
  );
}
