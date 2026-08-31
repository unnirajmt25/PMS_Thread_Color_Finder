import { useRef, useState } from "react";
import { formatDisplayDate } from "../utils/date";

/**
 * Admin's "upload a vendor spreadsheet" panel. Uploading a .xlsx under a
 * label that already exists replaces that vendor's color-mapping records
 * entirely — this is how an admin updates a vendor's chart without
 * touching individual rows.
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

  function handleDelete(fileEntry) {
    if (
      !window.confirm(
        `Remove the uploaded file for "${fileEntry.label}" and all ${fileEntry.recordCount} of its mappings? This cannot be undone.`
      )
    )
      return;
    onDelete(fileEntry.label);
  }

  return (
    <section className="vendor-files">
      <h2>Vendor Files</h2>
      <p>
        Upload a vendor's Thread Chart workbook (.xlsx). Uploading under a label that already exists replaces that
        vendor's mappings with the new file.
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
          {uploading ? "Uploading..." : "Upload .xlsx"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
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
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDelete(f)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
