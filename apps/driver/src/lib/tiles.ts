// Web Mercator tile math (the standard OSM/Google XYZ scheme) — lets the
// pickup preview render a real map from raster tile images with no map
// SDK/native dependency, consistent with the rest of this project's
// OSM-data-based approach (packages/shared/src/osm.ts). Tiles come from
// CARTO's free basemap CDN, not tile.openstreetmap.org directly: OSM's own
// tile servers are volunteer-run and explicitly disallow embedding in an
// app with a real user base (osm.wiki/Blocked is exactly what an app like
// this one gets back once traffic looks like production usage, which is
// what happened here) -- CARTO's basemaps are rendered from OSM data but
// are meant for exactly this kind of embedding, still free, still no API
// key. See https://github.com/CartoDB/basemap-styles for the terms.
const TILE_SIZE = 256;
const CARTO_SUBDOMAINS = ['a', 'b', 'c', 'd'];

function lonToPixelX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * 2 ** zoom * TILE_SIZE;
}
function latToPixelY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom * TILE_SIZE;
}

export interface TileGrid {
  tiles: { x: number; y: number; url: string }[]; // 3x3, row-major
  pinOffsetPx: { x: number; y: number }; // point's position within the grid, at native 256px/tile scale
  gridSizePx: number;
}

/** A 3x3 tile grid centered on (lat, lng), plus the point's exact pixel offset within it. */
export function buildTileGrid(lat: number, lng: number, zoom: number): TileGrid {
  const px = lonToPixelX(lng, zoom);
  const py = latToPixelY(lat, zoom);
  const centerTx = Math.floor(px / TILE_SIZE);
  const centerTy = Math.floor(py / TILE_SIZE);
  const originX = (centerTx - 1) * TILE_SIZE;
  const originY = (centerTy - 1) * TILE_SIZE;

  const tiles: { x: number; y: number; url: string }[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = centerTx + dx;
      const ty = centerTy + dy;
      const subdomain = CARTO_SUBDOMAINS[(tx + ty) % CARTO_SUBDOMAINS.length];
      tiles.push({ x: tx, y: ty, url: `https://${subdomain}.basemaps.cartocdn.com/light_all/${zoom}/${tx}/${ty}.png` });
    }
  }

  return { tiles, pinOffsetPx: { x: px - originX, y: py - originY }, gridSizePx: TILE_SIZE * 3 };
}
