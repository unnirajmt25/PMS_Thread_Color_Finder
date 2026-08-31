const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHex(value) {
  return typeof value === "string" && HEX_RE.test(value.trim());
}

export function normalizeHex(value) {
  if (!isValidHex(value)) return "";
  let hex = value.trim();
  if (hex.length === 4) {
    hex = "#" + [...hex.slice(1)].map((c) => c + c).join("");
  }
  return hex.toLowerCase();
}

/** Picks black or white text for legible contrast against a hex background. */
export function contrastText(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return "#1a1a1a";
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1a1a1a" : "#f5f5f5";
}

export function generateId() {
  return `rec_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 6)}`;
}
