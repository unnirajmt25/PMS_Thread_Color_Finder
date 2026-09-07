/**
 * Extracts the dominant colors from image pixel data by pixel-count
 * (coverage), not just visual prominence. The approach:
 *
 *  1. Skip a border margin around the image entirely - edge pixels (photo
 *     borders, drop shadows, anti-aliasing against a transparent/white
 *     background) are excluded so they can never be picked, and the
 *     central area is where "presence" is actually measured from.
 *  2. Group the remaining sampled pixels into coarse RGB buckets
 *     (quantization) and average each bucket - this is what "small color
 *     variations/noise" collapses into a handful of real colors instead
 *     of thousands of near-duplicate shades.
 *  3. Drop any bucket that covers less than `minCoverageRatio` of the
 *     sampled pixels - this is the "ignore small pixel areas" step, so a
 *     handful of stray/noise pixels can't out-rank a color that covers a
 *     real portion of the image.
 *  4. Rank the remaining buckets by pixel count (largest overall
 *     representation first) and greedily keep the top `count`, skipping
 *     any candidate too close in RGB space to one already kept - without
 *     this, an image dominated by one hue returns several near-identical
 *     shades of it instead of a useful palette.
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
 * @param {{
 *   count?: number,
 *   sampleStep?: number,
 *   edgeMarginRatio?: number,
 *   minCoverageRatio?: number,
 * }} opts
 *   `sampleStep` samples every Nth pixel (in both dimensions) instead of
 *   every pixel, so a large photo doesn't require scanning millions of
 *   pixels synchronously. `edgeMarginRatio` is the fraction of the
 *   image's width/height excluded from each border (0.08 = ignore the
 *   outer 8% on every side, sampling only the central 84%).
 *   `minCoverageRatio` is the minimum fraction of *sampled* (i.e.
 *   central-area) pixels a color must cover to be eligible at all.
 * @returns {{ hex: string, r: number, g: number, b: number, coverage: number }[]}
 *   `coverage` is that color's share of the sampled pixels (0-1).
 */
export function extractDominantColors(
  imageData,
  { count = 8, sampleStep = 3, edgeMarginRatio = 0.08, minCoverageRatio = 0.01 } = {}
) {
  const { data, width, height } = imageData;
  const marginX = Math.round(width * edgeMarginRatio);
  const marginY = Math.round(height * edgeMarginRatio);
  const buckets = new Map();
  let sampled = 0;

  for (let y = marginY; y < height - marginY; y += sampleStep) {
    for (let x = marginX; x < width - marginX; x += sampleStep) {
      const idx = (y * width + x) * 4;
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
      sampled++;
    }
  }

  if (sampled === 0) return [];

  const minCount = Math.max(1, Math.round(sampled * minCoverageRatio));

  const ranked = [...buckets.values()]
    .filter((bucket) => bucket.count >= minCount)
    .map((bucket) => ({
      r: Math.round(bucket.rSum / bucket.count),
      g: Math.round(bucket.gSum / bucket.count),
      b: Math.round(bucket.bSum / bucket.count),
      coverage: bucket.count / sampled,
    }))
    .sort((a, b) => b.coverage - a.coverage);

  const picked = [];
  for (const candidate of ranked) {
    if (picked.length >= count) break;
    if (picked.some((p) => rgbDistance(p, candidate) < MIN_DISTANCE)) continue;
    picked.push(candidate);
  }

  // The diversity filter above can leave fewer than `count` picks even
  // when plenty of real, sufficiently large color regions exist (e.g. a
  // photo with several close shades of one hue) - the number entered
  // should be how many colors come back, not just an upper bound. Fill
  // any remaining slots from the same ranked list, largest first, now
  // ignoring closeness to what's already picked.
  if (picked.length < count) {
    for (const candidate of ranked) {
      if (picked.length >= count) break;
      if (picked.includes(candidate)) continue;
      picked.push(candidate);
    }
  }

  return picked.map(({ r, g, b, coverage }) => ({ r, g, b, coverage, hex: rgbToHex(r, g, b) }));
}
