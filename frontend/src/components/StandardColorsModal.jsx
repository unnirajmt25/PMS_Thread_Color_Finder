import { useEffect, useMemo, useState } from "react";
import { getStandardColors } from "../services/standardColorsService";

/**
 * Read-only viewer for the company's "Standard Colors" reference chart
 * (name -> PMS code, from Thread Chart/Standerd Colors.xls). Intentionally
 * separate from vendor/PMS thread matching — nothing here is cross-
 * referenced against vendor thread charts, so it can't get mixed up with
 * that data.
 *
 * @param {{ onClose: () => void }} props
 */
export default function StandardColorsModal({ onClose }) {
  const [colors, setColors] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    getStandardColors()
      .then((data) => {
        if (!cancelled) setColors(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Could not load standard colors.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!colors) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return colors;
    return colors.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.pmsCode.toLowerCase().includes(needle)
    );
  }, [colors, query]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="standard-colors-title">
      <div className="modal standard-colors-modal">
        <div className="standard-colors-modal__header">
          <div>
            <h2 id="standard-colors-title">Standard Colors</h2>
            <p className="standard-colors-modal__subtitle">
              Our own standard color name and PMS reference chart — separate from any vendor's thread chart.
            </p>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="field">
          <label htmlFor="standard-colors-search" className="sr-only">
            Search standard colors
          </label>
          <input
            id="standard-colors-search"
            className="field__control"
            type="search"
            placeholder="Search by name or PMS code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {error && (
          <p className="state-msg state-msg--error" role="alert">
            {error}
          </p>
        )}
        {!error && !colors && <p className="state-msg">Loading standard colors...</p>}

        {colors && (
          <>
            <p className="standard-colors-modal__count">
              {filtered.length} of {colors.length} colors
            </p>
            <div className="standard-colors-modal__list-wrap">
              {filtered.length === 0 ? (
                <p className="state-msg">No standard colors match "{query}".</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Standard Color Name</th>
                      <th>PMS Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => (
                      <tr key={`${c.name}-${c.pmsCode}-${i}`}>
                        <td>{c.name}</td>
                        <td>{c.pmsCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
