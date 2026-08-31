import { isValidHex, normalizeHex, contrastText } from "../utils/color";

/**
 * @param {{ hex?: string, label: string, sublabel?: string, size?: "md" | "lg" }} props
 */
export default function ColorSwatch({ hex, label, sublabel, size = "md" }) {
  const valid = isValidHex(hex);
  const normalized = normalizeHex(hex);

  return (
    <div className={`color-swatch color-swatch--${size}`}>
      <div
        className={`color-swatch__box${valid ? "" : " color-swatch__box--empty"}`}
        style={valid ? { backgroundColor: normalized, color: contrastText(normalized) } : undefined}
        role="img"
        aria-label={valid ? `Color preview: ${label}, ${normalized}` : `No color preview available for ${label}`}
      >
        {!valid && <span className="color-swatch__placeholder">No preview</span>}
      </div>
      <div className="color-swatch__meta">
        <span className="color-swatch__label">{label}</span>
        {sublabel && <span className="color-swatch__sublabel">{sublabel}</span>}
      </div>
    </div>
  );
}
