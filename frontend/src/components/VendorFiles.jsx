import { useRef, useState } from "react";
import { formatDisplayDate } from "../utils/date";

/**
 * Admin's "upload a vendor thread chart" panel. Accepts .xlsx or .pdf.
 * Uploading under a label that already exists replaces that vendor's
 * color-mapping records entirely — this is how an admin updates a
 * vendor's chart without touching individual rows. PDF extraction is
 * best-effort (it reconstructs a table from the PDF's text layout) and
 * only works when the PDF actually contains a real data table. Existing
 * files are managed via an Edit dialog (replace the file, or delete it)
 * rather than a bare Delete button in the table.
 *
 * @param {{
 *   files: { label: string, fileName: string, uploadedAt: string, recordCount: number }[],
 *   vendors: string[],
 *   onUpload: (label: string, file: File) => Promise<void>,
 *   onDelete: (label: string) => void,
 * }} props
 */
export default function VendorFiles({ files, vendors, onUpload, onDelete }) {
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [editingFile, setEditingFile] = useState(null);
  const fileInputRef = useRef(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setMessage(null);

    if (!label.trim()) {
      setError("Enter a vendor label before choosing a file.");
      return;
    }

    setUploading(true);
    try {
      const isReplacing = vendors.includes(label.trim());
      await onUpload(label.trim(), file);
      setMessage(isReplacing ? `Replaced "${label.trim()}" with ${file.name}.` : `Added "${label.trim()}" from ${file.name}.`);
      setLabel("");
    } catch (err) {
      setError(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="vendor-files">
      <h2>Vendor Files</h2>
      <p>
        Upload a vendor's Thread Chart as .xlsx or .pdf. Uploading under a label that already exists replaces that
        vendor's mappings with the new file. PDF tables are extracted on a best-effort basis — it needs an actual
        text-based Thread Number / PMS Number table, not a scanned image or a link list.
      </p>

      <div className="vendor-files__upload">
        <div className="field">
          <label htmlFor="vendor-file-label" className="field__label">
            Vendor Label
          </label>
          <input
            id="vendor-file-label"
            className="field__control"
            list="vendor-files-existing-labels"
            placeholder='e.g. "4imprint Thread Charts"'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={uploading}
          />
          <datalist id="vendor-files-existing-labels">
            {vendors.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload File"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.pdf"
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>

      {error && (
        <p className="state-msg state-msg--error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="state-msg" role="status">
          {message}
        </p>
      )}

      {files.length === 0 ? (
        <p className="vendor-files__empty">No files uploaded yet — vendors from the bundled dataset aren't tracked here until you upload a replacement for them.</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>File</th>
                <th>Mappings</th>
                <th>Last Updated</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.label}>
                  <td>{f.label}</td>
                  <td>{f.fileName}</td>
                  <td>{f.recordCount}</td>
                  <td>{formatDisplayDate(f.uploadedAt)}</td>
                  <td className="data-table__actions">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditingFile(f)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingFile && (
        <EditVendorFileModal
          file={editingFile}
          onUpload={onUpload}
          onDelete={onDelete}
          onClose={() => setEditingFile(null)}
        />
      )}
    </section>
  );
}

function EditVendorFileModal({ file, onUpload, onDelete, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const replaceInputRef = useRef(null);

  async function handleReplaceFile(e) {
    const newFile = e.target.files?.[0];
    e.target.value = "";
    if (!newFile) return;

    setError(null);
    setBusy(true);
    try {
      await onUpload(file.label, newFile);
      onClose();
    } catch (err) {
      setError(err.message ?? "Upload failed.");
      setBusy(false);
    }
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Remove the uploaded file for "${file.label}" and all ${file.recordCount} of its mappings? This cannot be undone.`
      )
    )
      return;
    onDelete(file.label);
    onClose();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-vendor-file-title">
      <div className="modal">
        <h2 id="edit-vendor-file-title">Edit Vendor File</h2>

        <dl className="match-card__details vendor-files__edit-details">
          <div>
            <dt>Label</dt>
            <dd>{file.label}</dd>
          </div>
          <div>
            <dt>Current File</dt>
            <dd>{file.fileName}</dd>
          </div>
          <div>
            <dt>Mappings</dt>
            <dd>{file.recordCount}</dd>
          </div>
          <div>
            <dt>Last Updated</dt>
            <dd>{formatDisplayDate(file.uploadedAt)}</dd>
          </div>
        </dl>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="record-form__actions vendor-files__edit-actions">
          <button type="button" className="btn btn--danger" onClick={handleDelete} disabled={busy}>
            Delete This File
          </button>
          <div className="vendor-files__edit-actions-right">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
              Close
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => replaceInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? "Uploading..." : "Replace File"}
            </button>
            <input
              ref={replaceInputRef}
              type="file"
              accept=".xlsx,.pdf"
              className="sr-only"
              onChange={handleReplaceFile}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
