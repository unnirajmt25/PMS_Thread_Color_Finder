import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useColorData } from "../hooks/useColorData";
import DataTable from "../components/DataTable";

const PREVIEW_ROWS = 50;

export default function Vendors() {
  const { records, status } = useColorData();
  const [openVendor, setOpenVendor] = useState(null);

  const vendorGroups = useMemo(() => {
    const map = new Map();
    for (const record of records) {
      if (!map.has(record.vendor)) map.set(record.vendor, []);
      map.get(record.vendor).push(record);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [records]);

  return (
    <div className="page vendors-page">
      <header className="page-header">
        <h1>Vendors</h1>
        <p>Browse every vendor and its thread-to-PMS color mappings.</p>
      </header>

      {status === "loading" && <p className="state-msg">Loading vendors...</p>}

      {status === "ready" && vendorGroups.length === 0 && (
        <p className="state-msg">
          No vendors yet. <Link to="/app/admin">Add one from the Admin page</Link>.
        </p>
      )}

      {status === "ready" && (
        <div className="vendor-list">
          {vendorGroups.map(([vendor, vendorRecords]) => {
            const isOpen = openVendor === vendor;
            return (
              <section className="vendor-group" key={vendor}>
                <button
                  type="button"
                  className="vendor-group__header"
                  onClick={() => setOpenVendor(isOpen ? null : vendor)}
                  aria-expanded={isOpen}
                >
                  <span className="vendor-group__name">{vendor}</span>
                  <span className="vendor-group__count">
                    {vendorRecords.length} {vendorRecords.length === 1 ? "mapping" : "mappings"}
                  </span>
                  <span className="vendor-group__chevron" aria-hidden="true">
                    {isOpen ? "▾" : "▸"}
                  </span>
                </button>
                {isOpen && (
                  <div className="vendor-group__body">
                    <DataTable records={vendorRecords.slice(0, PREVIEW_ROWS)} />
                    {vendorRecords.length > PREVIEW_ROWS && (
                      <p className="vendor-group__preview-note">
                        Showing the first {PREVIEW_ROWS} of {vendorRecords.length} mappings.
                      </p>
                    )}
                    <Link className="btn btn--ghost btn--sm" to={`/app/admin?vendor=${encodeURIComponent(vendor)}`}>
                      Manage this vendor in Admin
                    </Link>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
