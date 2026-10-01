interface RealmCloudSvgOptions {
  width: number;
  height: number;
  seed: number;
  density: number;
  groundVisibility: number;
  editorClouds: boolean;
}

export function createRealmCloudSvg({
  width,
  height,
  seed,
  density,
  groundVisibility,
  editorClouds
}: RealmCloudSvgOptions): string {
  const normalizedDensity = clamp(density);
  const veilOpacity = 1 - clamp(groundVisibility);
  const groundVeil = editorClouds
    ? `<rect width="${width}" height="${height}" fill="#b9d3eb" fill-opacity="${veilOpacity.toFixed(3)}" />`
    : "";

  if (!normalizedDensity) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${groundVeil}</svg>`;
  }

  const cloudOffset = -0.82 + normalizedDensity * 0.48;
  const detailSeed = (seed + 137) % 1000;
  return /* html */ `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <defs>
      <filter id="cloud-noise" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.003 0.006" numOctaves="5" seed="${seed}" stitchTiles="stitch" result="large-noise" />
        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.036" numOctaves="4" seed="${detailSeed}" stitchTiles="stitch" result="detail-noise" />
        <feBlend in="large-noise" in2="detail-noise" mode="screen" result="noise" />
        <feColorMatrix in="noise" type="luminanceToAlpha" result="alpha" />
        <feComponentTransfer in="alpha" result="soft-clouds">
          <feFuncA type="gamma" amplitude="1.7" exponent="1.2" offset="${cloudOffset.toFixed(3)}" />
        </feComponentTransfer>
        <feGaussianBlur in="soft-clouds" stdDeviation="6" edgeMode="wrap" result="blurred-clouds" />
        <feFlood flood-color="#f7fbff" flood-opacity="${normalizedDensity.toFixed(3)}" result="cloud-colour" />
        <feComposite in="cloud-colour" in2="blurred-clouds" operator="in" />
      </filter>
    </defs>
    ${groundVeil}
    <rect width="${width}" height="${height}" fill="transparent" filter="url(#cloud-noise)" />
  </svg>`;
}

function clamp(value: number): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);
}
