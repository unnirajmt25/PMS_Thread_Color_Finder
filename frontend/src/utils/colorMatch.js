import { isValidHex, normalizeHex } from "./color";

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

/**
 * Straight-line RGB distance. Not perceptually uniform (a proper Delta E
 * needs Lab values this app doesn't have), but good enough to rank
 * "closest" thread colors against a picked pixel — see backend
 * docs/DATABASE.md for why calculated color-distance metrics are kept
 * clearly separate from vendor-supplied ground truth.
 */
export function colorDistance(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return Infinity;
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/**
 * Ranks `records` by how close each one's `threadHex` is to `hex`,
 * closest first. Records with no usable thread color are excluded rather
 * than sorted to the bottom, since they're not a match at all.
 *
 * @param {string} hex
 * @param {import('../types').ColorMapping[]} records
 * @param {number} limit
 * @returns {{ record: import('../types').ColorMapping, distance: number }[]}
 */
export function findClosestThreads(hex, records, limit = 3) {
  return records
    .filter((r) => isValidHex(r.threadHex))
    .map((record) => ({ record, distance: colorDistance(hex, record.threadHex) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
