import { useState } from "react";
import { isValidHex, normalizeHex, contrastText } from "../utils/color";

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 13.5H3.75A1.75 1.75 0 0 1 2 11.75v-8A1.75 1.75 0 0 1 3.75 2h8A1.75 1.75 0 0 1 13.5 3.75V4.5"
        stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Large full-color match card: a color swatch fills the whole card, with
 * its hex value and the record's thread/PMS codes overlaid on top - the
 * thread code and PMS code are click-to-copy.
 *
 * @param {{ hex: string, label: string, threadCode: string, pmsCode: string }} props
 */
export default function MatchColorCard({ hex, label, threadCode, pmsCode }) {
  const [copied, setCopied] = useState(null); // "thread" | "pms" | null

  const valid = isValidHex(hex);
  const normalized = valid ? normalizeHex(hex) : "";
  const textColor = valid ? contrastText(normalized) : undefined;

  async function handleCopy(text, field) {
    const ok = await copyText(text);
    if (ok) {
      setCopied(field);
      setTimeout(() => setCopied((c) => (c === field ? null : c)), 1500);
    }
  }

  return (
    <div
      className={`match-color-card${valid ? "" : " match-color-card--empty"}`}
      style={valid ? { backgroundColor: normalized, color: textColor } : undefined}
      role="img"
      aria-label={valid ? `${label}: ${normalized}` : `No color preview available for ${label}`}
    >
      {!valid ? (
        <span className="match-color-card__placeholder">No color preview available</span>
      ) : (
        <>
          <div className="match-color-card__hex">
            <span className="match-color-card__label">Hex</span>
            <span className="match-color-card__hex-value">{normalized.toUpperCase()}</span>
          </div>
          <div className="match-color-card__codes">
            {threadCode && (
              <button
                type="button"
                className="match-color-card__code-btn"
                style={{ color: textColor }}
                onClick={() => handleCopy(threadCode, "thread")}
              >
                <span>{copied === "thread" ? "Copied!" : `THREAD COLOR: ${threadCode}`}</span>
                <CopyIcon />
              </button>
            )}
            {pmsCode && (
              <button
                type="button"
                className="match-color-card__code-btn"
                style={{ color: textColor }}
                onClick={() => handleCopy(pmsCode, "pms")}
              >
                <span>{copied === "pms" ? "Copied!" : `PMS: ${pmsCode}`}</span>
                <CopyIcon />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
