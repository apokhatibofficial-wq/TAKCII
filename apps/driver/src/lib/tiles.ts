// Web Mercator tile math (the standard OSM/Google XYZ scheme) — lets the
// pickup preview render a real map from raw OpenStreetMap tile images
// with no map SDK/native dependency, consistent with the rest of this
// project's OSM-based approach (packages/shared/src/osm.ts).
const TILE_SIZE = 256;

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
      tiles.push({ x: tx, y: ty, url: `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png` });
    }
  }

  return { tiles, pinOffsetPx: { x: px - originX, y: py - originY }, gridSizePx: TILE_SIZE * 3 };
}
