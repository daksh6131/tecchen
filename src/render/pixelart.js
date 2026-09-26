// Pixel-grid sprite utilities. Grids are arrays of equal-length strings;
// each char maps to a palette color, '.' is transparent.

export function parseGrid(rows, palette) {
  const h = rows.length;
  const w = rows[0].length;
  const pixels = [];
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error(`row ${y} width ${rows[y].length} != ${w}`);
    const line = [];
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.') { line.push(null); continue; }
      const color = palette[ch];
      if (!color) throw new Error(`unknown palette char '${ch}' at ${x},${y}`);
      line.push(color);
    }
    pixels.push(line);
  }
  return { w, h, pixels };
}

export function darken(hex, amt = 36) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - amt);
  const g = Math.max(0, ((n >> 8) & 255) - amt);
  const b = Math.max(0, (n & 255) - amt);
  return `rgb(${r},${g},${b})`;
}

const cache = new Map();
const OUTLINE = '#131019';

// Any transparent cell touching a filled cell becomes outline — gives every
// sprite the crisp dark edge of classic fighter pixel art. Pure; testable.
export function outlineMask(grid) {
  const out = [];
  for (let y = 0; y < grid.h; y++) {
    const line = [];
    for (let x = 0; x < grid.w; x++) {
      if (grid.pixels[y][x]) { line.push(false); continue; }
      const n =
        (y > 0 && grid.pixels[y - 1][x]) ||
        (y < grid.h - 1 && grid.pixels[y + 1][x]) ||
        (x > 0 && grid.pixels[y][x - 1]) ||
        (x < grid.w - 1 && grid.pixels[y][x + 1]);
      line.push(!!n);
    }
    out.push(line);
  }
  return out;
}

// Bake a part (grid+palette) to an offscreen canvas once. Browser-only.
export function spriteCanvas(part, scale = 2, dim = false) {
  const key = `${part.id}:${scale}:${dim}`;
  let cv = cache.get(key);
  if (cv) return cv;

  const grid = parseGrid(part.rows, part.palette);
  const edge = outlineMask(grid);
  cv = document.createElement('canvas');
  cv.width = grid.w * scale;
  cv.height = grid.h * scale;
  const c = cv.getContext('2d');
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const col = grid.pixels[y][x] ? (dim ? darken(grid.pixels[y][x]) : grid.pixels[y][x])
        : (edge[y][x] ? OUTLINE : null);
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  cache.set(key, cv);
  return cv;
}
