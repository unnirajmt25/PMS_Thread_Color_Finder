import ColorSwatch from "./ColorSwatch";

const MAX_VISIBLE_RESULTS = 50;

/**
 * @param {{
 *   results: import('../types').ColorMapping[],
 *   onSelect: (record: import('../types').ColorMapping) => void,
 *   query: string,
 * }} props
 */
export default function SearchResults({ results, onSelect, query }) {
  if (!query.trim()) return null;

  if (results.length === 0) {
    return (
      <div className="search-results search-results--empty" role="status">
        No threads or PMS colors match "{query}".
      </div>
    );
  }

  const visible = results.slice(0, MAX_VISIBLE_RESULTS);
  const hiddenCount = results.length - visible.length;

  return (
    <ul className="search-results" role="listbox" aria-label="Search results">
      {visible.map((record) => (
        <li key={record.id} role="option">
          <button type="button" className="search-results__item" onClick={() => onSelect(record)}>
            <ColorSwatch hex={record.threadHex} label="thread color" size="sm" />
            <div className="search-results__item-body">
              <span className="search-results__item-title">
                {record.threadBrand} {record.threadCode}
                {record.threadColorName ? ` — ${record.threadColorName}` : ""}
              </span>
              <span className="search-results__item-sub">
                {record.vendor} · {record.pmsCode ? `Matched PMS ${record.pmsCode}` : "No PMS match yet"}
              </span>
            </div>
            <ColorSwatch hex={record.pmsHex} label="Monitor Display Color" size="sm" />
          </button>
        </li>
      ))}
      {hiddenCount > 0 && (
        <li className="search-results__more">
          {hiddenCount} more result{hiddenCount === 1 ? "" : "s"} — refine your search to narrow it down.
        </li>
      )}
    </ul>
  );
}
