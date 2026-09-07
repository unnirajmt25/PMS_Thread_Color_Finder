import { useEffect, useMemo, useState } from "react";
import { useColorData } from "../hooks/useColorData";
import { debounce } from "../utils/debounce";
import VendorSelector from "../components/VendorSelector";
import OptionSelector from "../components/OptionSelector";
import ThreadSearch from "../components/ThreadSearch";
import SearchResults from "../components/SearchResults";
import ColorMatchCard from "../components/ColorMatchCard";

function threadKey(r) {
  return `${r.vendor}|${r.threadBrand}|${r.threadCode}`.toLowerCase();
}

export default function Finder() {
  const { records, status, error } = useColorData();

  const [vendor, setVendor] = useState("");
  const [threadBrand, setThreadBrand] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedSetQuery = useMemo(() => debounce(setSearchQuery, 250), []);

  useEffect(() => () => debouncedSetQuery.cancel(), [debouncedSetQuery]);

  function handleSearchChange(value) {
    setSearchInput(value);
    debouncedSetQuery(value);
  }

  const vendors = useMemo(
    () => [...new Set(records.map((r) => r.vendor))].sort((a, b) => a.localeCompare(b)),
    [records]
  );

  const vendorRecords = useMemo(
    () => (vendor ? records.filter((r) => r.vendor === vendor) : records),
    [records, vendor]
  );

  const threadBrands = useMemo(
    () => [...new Set(vendorRecords.map((r) => r.threadBrand))].sort((a, b) => a.localeCompare(b)),
    [vendorRecords]
  );

  const scopedRecords = useMemo(
    () => (threadBrand ? vendorRecords.filter((r) => r.threadBrand === threadBrand) : vendorRecords),
    [vendorRecords, threadBrand]
  );

  const searchResults = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return [];
    return records.filter((r) =>
      [r.vendor, r.threadBrand, r.threadCode, r.threadColorName, r.pmsCode, r.pmsName]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [records, searchQuery]);

  const selected = records.find((r) => r.id === selectedId) ?? null;

  const relatedMatches = useMemo(() => {
    if (!selected) return [];
    const key = threadKey(selected);
    return records.filter((r) => threadKey(r) === key);
  }, [records, selected]);

  function selectRecord(record) {
    setSelectedId(record?.id ?? "");
    if (record) {
      setVendor(record.vendor);
      setThreadBrand(record.threadBrand);
    }
    setSearchInput("");
    setSearchQuery("");
  }

  return (
    <div className="page finder-page">
      <header className="finder-hero">
        <h1>Thread Color Finder</h1>
        <p>Find the closest PMS color for your thread</p>
        <div className="field finder-hero__search">
          <label htmlFor="global-search" className="sr-only">
            Search thread or PMS color
          </label>
          <input
            id="global-search"
            className="field__control field__control--search"
            type="search"
            placeholder="Search thread or PMS color..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <SearchResults results={searchResults} query={searchQuery} onSelect={selectRecord} />
      </header>

      {status === "loading" && <p className="state-msg">Loading color database...</p>}
      {status === "error" && (
        <p className="state-msg state-msg--error" role="alert">
          Could not load the color database{error?.message ? `: ${error.message}` : "."}
        </p>
      )}

      {status === "ready" && (
        <>
          <div className="finder-controls">
            <VendorSelector
              vendors={vendors}
              value={vendor}
              onChange={(v) => {
                setVendor(v);
                setThreadBrand("");
                setSelectedId("");
              }}
            />
            <OptionSelector
              id="thread-brand-selector"
              label="Thread Chart"
              allLabel="All Thread Charts"
              options={threadBrands}
              value={threadBrand}
              onChange={(b) => {
                setThreadBrand(b);
                setSelectedId("");
              }}
            />
            <ThreadSearch records={scopedRecords} selectedId={selectedId} onSelect={selectRecord} />
          </div>

          {records.length === 0 && (
            <p className="state-msg">No color mappings in the database yet. Add some from the Admin page.</p>
          )}

          {!selected && records.length > 0 && (
            <p className="state-msg">Select a vendor and thread, or search above, to see the PMS match.</p>
          )}

          {selected && (
            <div className="finder-results">
              <ColorMatchCard record={selected} />
              {relatedMatches.length > 1 && (
                <section className="alt-matches" aria-label="Other possible PMS matches">
                  <h3>Other Possible Matches</h3>
                  <p>Multiple PMS matches are on record for this thread.</p>
                  <ul>
                    {relatedMatches
                      .filter((r) => r.id !== selected.id)
                      .map((r) => (
                        <li key={r.id}>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => selectRecord(r)}>
                            {r.pmsName || (r.pmsCode ? `PMS ${r.pmsCode}` : "No PMS code recorded")}
                          </button>
                        </li>
                      ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
