import { RealmData } from "@/components/realm-data";
import {
  getAltitude,
  isInVerticalRange,
  type VerticalObject,
  type VerticalObjectKind
} from "@/components/vertical-coordinates";

const GEO_LAYERS = [
  "landmass",
  "coastline",
  "lakes",
  "states",
  "borders",
  "provinces",
  "biomes",
  "cultures",
  "religions",
  "rivers",
  "relief",
  "terrs",
  "population",
  "ice"
];

export function drawVerticalFilter(): void {
  const defs = document.querySelector("#map defs");
  if (!defs) return;
  let style = defs.querySelector<SVGStyleElement>("#realmVerticalStyle");
  if (!style) {
    style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.id = "realmVerticalStyle";
    defs.append(style);
  }
  let clip = defs.querySelector<SVGClipPathElement>("#realmVerticalClip");
  if (!clip) {
    clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
    clip.id = "realmVerticalClip";
    clip.setAttribute("clipPathUnits", "userSpaceOnUse");
    defs.append(clip);
  }
  const filter = RealmData.getVerticalFilter(RealmData.active);
  if (RealmData.active !== "sky" || !filter.enabled) {
    style.textContent = "";
    clip.replaceChildren();
    return;
  }

  const islands = pack.features.filter(
    feature => feature?.land && isInVerticalRange(getAltitude(pack, feature, "island"), filter)
  );
  clip.replaceChildren(
    ...islands.flatMap(feature => {
      const source = defs.querySelector<SVGPathElement>(`#feature_${feature.i}`);
      return source ? [source.cloneNode(true) as SVGPathElement] : [];
    })
  );
  for (const child of clip.children) child.removeAttribute("id");

  const hidden: string[] = [];
  const collect = (objects: VerticalObject[], kind: VerticalObjectKind, prefixes: string[]) => {
    for (const object of objects) {
      if (!object || (kind === "burg" && !object.i)) continue;
      if (!isInVerticalRange(getAltitude(pack, object, kind), filter)) {
        hidden.push(...prefixes.map(prefix => `#${prefix}${object.i}`));
      }
    }
  };
  collect(pack.burgs, "burg", ["burg", "anchor", "burgLabel", "burgEmblem"]);
  collect(pack.markers, "marker", ["marker"]);
  collect(pack.routes, "route", ["route", "routeLabel"]);
  collect(pack.zones, "zone", ["zone"]);
  const css = `${GEO_LAYERS.map(id => `#${id}`).join(",")} { clip-path: url(#realmVerticalClip); }`;
  style.textContent = css + (hidden.length ? `${hidden.join(",")} { display: none !important; }` : "");
}
