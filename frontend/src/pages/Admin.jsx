import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useColorData } from "../hooks/useColorData";
import {
  addRecord,
  deleteRecord,
  deleteVendor,
  deleteVendorFile,
  exportCsv,
  getVendorFiles,
  importCsv,
  renameVendor,
  resetToSeed,
  updateRecord,
  uploadVendorFile,
  ValidationError,
} from "../services/colorService";
import DataTable from "../components/DataTable";
import RecordForm from "../components/RecordForm";
import VendorFiles from "../components/VendorFiles";
import AdminLogin from "../components/AdminLogin";
import { isAdminAuthenticated, logoutAdmin } from "../services/authService";

const PAGE_SIZE = 50;

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(isAdminAuthenticated());
  const { records, status } = useColorData();
  const [searchParams, setSearchParams] = useSearchParams();
  const vendorFilter = searchParams.get("vendor") ?? "";
  const [query, setQuery] = useState("");
  const [formMode, setFormMode] = useState(null); // null | "add" | record being edited
  const [formError, setFormError] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState(null);
  const [page, setPage] = useState(0);
  const [vendorFiles, setVendorFiles] = useState([]);
  const fileInputRef = useRef(null);

  // Vendor-file registry lives outside the reactive record store, so
  // re-fetch it whenever `records` changes reference (i.e. after any
  // mutation, including uploads/deletes) to keep the two in sync.
  useEffect(() => {
    getVendorFiles().then(setVendorFiles);
  }, [records]);

  const vendors = useMemo(
    () => [...new Set(records.map((r) => r.vendor))].sort((a, b) => a.localeCompare(b)),
    [records]
  );

  const filtered = useMemo(() => {
    let result = vendorFilter ? records.filter((r) => r.vendor === vendorFilter) : records;
    const needle = query.trim().toLowerCase();
    if (needle) {
      result = result.filter((r) =>
        [r.vendor, r.threadBrand, r.threadCode, r.threadColorName, r.pmsCode, r.pmsName, r.notes]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    }
    return result;
  }, [records, vendorFilter, query]);

  useEffect(() => {
    setPage(0);
  }, [vendorFilter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageStart = clampedPage * PAGE_SIZE;
  const pageRecords = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  if (!authenticated) {
    return (
      <div className="page admin-page">
        <AdminLogin onSuccess={() => setAuthenticated(true)} />
      </div>
    );
  }

  function handleLogout() {
    logoutAdmin();
    setAuthenticated(false);
  }

  async function handleAdd(values) {
    setFormError(null);
    try {
      await addRecord(values);
      setFormMode(null);
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw err;
    }
  }

  async function handleEditSubmit(values) {
    try {
      await updateRecord(formMode.id, values);
      setFormMode(null);
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw err;
    }
  }

  async function handleDelete(record) {
    const label = `${record.threadBrand} ${record.threadCode}`.trim();
    if (!window.confirm(`Delete "${label}" from ${record.vendor}? This cannot be undone.`)) return;
    await deleteRecord(record.id);
  }

  async function handleDeleteVendor(vendor) {
    const count = records.filter((r) => r.vendor === vendor).length;
    if (
      !window.confirm(
        `Delete vendor "${vendor}" and all ${count} of its mappings? This cannot be undone.`
      )
    )
      return;
    await deleteVendor(vendor);
    if (vendorFilter === vendor) setSearchParams({});
  }

  async function handleRenameVendor(vendor) {
    const next = window.prompt(`Rename vendor "${vendor}" to:`, vendor);
    if (!next || next.trim() === vendor) return;
    await renameVendor(vendor, next);
    setSearchParams({ vendor: next.trim() });
  }

  async function handleUploadVendorFile(label, file) {
    await uploadVendorFile(label, file);
  }

  async function handleDeleteVendorFile(label) {
    await deleteVendorFile(label);
    if (vendorFilter === label) setSearchParams({});
  }

  async function handleExport() {
    const csv = await exportCsv(filtered);
    downloadCsv(csv, `thred-finder-export-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function handleReset() {
    if (
      !window.confirm(
        "Reload the vendor thread charts and discard every admin edit made in this browser? This cannot be undone."
      )
    )
      return;
    await resetToSeed();
    setImportSummary(null);
    setImportError(null);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    setImportSummary(null);
    try {
      const text = await file.text();
      const summary = await importCsv(text);
      setImportSummary(summary);
    } catch (err) {
      setImportError(err.message ?? "Import failed.");
    }
  }

  return (
    <div className="page admin-page">
      <header className="page-header admin-page__header">
        <div>
          <h1>Admin</h1>
          <p>Manage the vendor and color-mapping database.</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
          Log Out
        </button>
      </header>

      <VendorFiles
        files={vendorFiles}
        vendors={vendors}
        onUpload={handleUploadVendorFile}
        onDelete={handleDeleteVendorFile}
      />

      <div className="admin-toolbar">
        <div className="field admin-toolbar__search">
          <label htmlFor="admin-search" className="sr-only">
            Search records
          </label>
          <input
            id="admin-search"
            className="field__control"
            type="search"
            placeholder="Search vendor, thread, PMS..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="admin-vendor-filter" className="sr-only">
            Filter by vendor
          </label>
          <select
            id="admin-vendor-filter"
            className="field__control"
            value={vendorFilter}
            onChange={(e) => setSearchParams(e.target.value ? { vendor: e.target.value } : {})}
          >
            <option value="">All Vendors</option>
            {vendors.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-toolbar__actions">
          <button type="button" className="btn btn--primary" onClick={() => setFormMode("add")}>
            + Add Mapping
          </button>
          <button type="button" className="btn btn--ghost" onClick={handleExport}>
            Export CSV
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => fileInputRef.current?.click()}>
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={handleImportFile}
          />
          <button type="button" className="btn btn--ghost" onClick={handleReset}>
            Reload Vendor Data
          </button>
        </div>
      </div>

      {vendorFilter && (
        <div className="admin-vendor-actions">
          <span>
            Managing <strong>{vendorFilter}</strong>
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleRenameVendor(vendorFilter)}>
            Rename Vendor
          </button>
          <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDeleteVendor(vendorFilter)}>
            Delete Vendor
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSearchParams({})}>
            Clear Filter
          </button>
        </div>
      )}

      {importError && (
        <p className="state-msg state-msg--error" role="alert">
          {importError}
        </p>
      )}
      {importSummary && (
        <p className="state-msg" role="status">
          Import complete: {importSummary.added} added, {importSummary.updated} updated
          {importSummary.skipped.length > 0 ? `, ${importSummary.skipped.length} skipped (missing required fields)` : ""}.
        </p>
      )}

      {status === "loading" && <p className="state-msg">Loading database...</p>}

      {status === "ready" && (
        <>
          <div className="admin-result-count">
            {filtered.length === 0
              ? "No records"
              : `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length} records`}
          </div>
          <DataTable
            records={pageRecords}
            onEdit={(record) => setFormMode(record)}
            onDelete={handleDelete}
          />
          {pageCount > 1 && (
            <div className="pager">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={clampedPage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <span>
                Page {clampedPage + 1} of {pageCount}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={clampedPage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {formMode && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="record-form-title">
          <div className="modal">
            <h2 id="record-form-title">{formMode === "add" ? "Add Mapping" : "Edit Mapping"}</h2>
            <RecordForm
              vendors={vendors}
              initialValue={formMode === "add" ? { vendor: vendorFilter } : formMode}
              submitLabel={formMode === "add" ? "Add Mapping" : "Save Changes"}
              onSubmit={formMode === "add" ? handleAdd : handleEditSubmit}
              onCancel={() => setFormMode(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
