/**
 * Extracts the most visually distinct dominant colors from image pixel
 * data. Groups pixels into coarse RGB buckets (quantization), ranks
 * buckets by pixel count, then greedily keeps the most-populous buckets
 * that are sufficiently different from ones already picked — without that
 * dedup step, an image dominated by one hue returns several near
 * -identical shades of it instead of a useful palette.
 */
const BUCKET_SIZE = 24; // RGB quantization step
const MIN_DISTANCE = 40; // minimum RGB distance between two kept colors
const ALPHA_THRESHOLD = 128; // skip mostly-transparent pixels

function bucketKey(r, g, b) {
  return `${(r / BUCKET_SIZE) | 0}_${(g / BUCKET_SIZE) | 0}_${(b / BUCKET_SIZE) | 0}`;
}

function rgbDistance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * @param {ImageData} imageData
 * @param {{ count?: number, sampleStep?: number }} opts
 *   `sampleStep` samples every Nth pixel instead of every pixel, so a
 *   large photo doesn't require scanning millions of pixels synchronously.
 * @returns {{ hex: string, r: number, g: number, b: number }[]}
 */
export function extractDominantColors(imageData, { count = 8, sampleStep = 4 } = {}) {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const buckets = new Map();

  for (let i = 0; i < totalPixels; i += sampleStep) {
    const idx = i * 4;
    if (data[idx + 3] < ALPHA_THRESHOLD) continue;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const key = bucketKey(r, g, b);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.rSum += r;
      bucket.gSum += g;
      bucket.bSum += b;
      bucket.count += 1;
    } else {
      buckets.set(key, { rSum: r, gSum: g, bSum: b, count: 1 });
    }
  }

  const ranked = [...buckets.values()]
    .map((bucket) => ({
      r: Math.round(bucket.rSum / bucket.count),
      g: Math.round(bucket.gSum / bucket.count),
      b: Math.round(bucket.bSum / bucket.count),
      count: bucket.count,
    }))
    .sort((a, b) => b.count - a.count);

  const picked = [];
  for (const candidate of ranked) {
    if (picked.length >= count) break;
    if (picked.some((p) => rgbDistance(p, candidate) < MIN_DISTANCE)) continue;
    picked.push(candidate);
  }

  return picked.map(({ r, g, b }) => ({ r, g, b, hex: rgbToHex(r, g, b) }));
}
