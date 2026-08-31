import { useEffect, useId, useMemo, useRef, useState } from "react";

const MAX_VISIBLE_OPTIONS = 50;

function threadLabel(record) {
  return `${record.threadBrand} ${record.threadCode}`.trim();
}

/**
 * Searchable combobox for picking a single thread/color record, scoped to
 * whatever `records` the caller passes in (e.g. already filtered by vendor).
 *
 * @param {{
 *   records: import('../types').ColorMapping[],
 *   selectedId: string,
 *   onSelect: (record: import('../types').ColorMapping | null) => void,
 *   disabled?: boolean,
 *   placeholder?: string,
 * }} props
 */
export default function ThreadSearch({ records, selectedId, onSelect, disabled, placeholder }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const containerRef = useRef(null);

  const selected = records.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    setQuery(selected ? threadLabel(selected) : "");
  }, [selected?.id]);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || (selected && threadLabel(selected).toLowerCase() === needle)) return records;
    return records.filter((r) =>
      [r.threadBrand, r.threadCode, r.threadColorName, r.pmsCode, r.pmsName]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [records, query, selected]);

  const filtered = matches.slice(0, MAX_VISIBLE_OPTIONS);
  const hiddenCount = matches.length - filtered.length;

  function handlePick(record) {
    onSelect(record);
    setQuery(threadLabel(record));
    setOpen(false);
  }

  return (
    <div className="field combobox" ref={containerRef}>
      <label htmlFor="thread-search-input" className="field__label">
        Thread / Color
      </label>
      <input
        id="thread-search-input"
        className="field__control"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={disabled ? "Select a vendor first, or search all vendors" : placeholder ?? "Select or search..."}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (selected) onSelect(null);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && !disabled && (
        <ul className="combobox__list" id={listboxId} role="listbox">
          {filtered.length === 0 && <li className="combobox__empty">No matching threads.</li>}
          {filtered.map((record) => (
            <li key={record.id} role="option" aria-selected={record.id === selectedId}>
              <button type="button" className="combobox__option" onClick={() => handlePick(record)}>
                <span className="combobox__option-title">{threadLabel(record)}</span>
                <span className="combobox__option-sub">
                  {record.vendor} · {record.pmsCode ? `PMS ${record.pmsCode}` : "No PMS match"}
                </span>
              </button>
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="combobox__empty">
              {hiddenCount} more match{hiddenCount === 1 ? "" : "es"} — keep typing to narrow it down.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
