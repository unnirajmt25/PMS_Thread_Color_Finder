import { useRef, useState } from "react";
import { formatDisplayDateTime } from "../utils/date";
import { vendorLabelMatchesFileName, vendorLabelFromFileName } from "../utils/text";

function summaryLine(count) {
  const padded = String(count).padStart(2, "0");
  return `${padded} file${count === 1 ? "" : "s"} uploaded successfully.`;
}

/**
 * Admin's "upload a vendor thread chart" panel. Accepts .xlsx or .pdf,
 * singly or in a batch (select multiple files at once). Uploading under a
 * label that already exists replaces that vendor's color-mapping records
 * entirely — this is how an admin updates a vendor's chart without
 * touching individual rows, so replacing always asks for confirmation
 * first. PDF extraction is best-effort (it reconstructs a table from the
 * PDF's text layout) and only works when the PDF actually contains a real
 * data table. Existing files are managed via an Edit dialog (replace the
 * file, or delete it) rather than a bare Delete button in the table.
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

  function findExisting(vendorLabel) {
    return files.find((f) => f.label === vendorLabel);
  }

  async function uploadSingle(trimmedLabel, file) {
    if (!vendorLabelMatchesFileName(trimmedLabel, file.name)) {
      setError(
        `"${file.name}" doesn't look like it belongs to "${trimmedLabel}" — double-check you picked the right vendor before uploading.`
      );
      return;
    }

    const existing = findExisting(trimmedLabel);
    if (existing) {
      const proceed = window.confirm(
        `A file already exists for "${trimmedLabel}" (${existing.fileName}, last updated ${formatDisplayDateTime(existing.uploadedAt)}).\n\nUploading will replace it and all of its current mappings. Continue?`
      );
      if (!proceed) return;
    }

    setUploading(true);
    try {
      await onUpload(trimmedLabel, file);
      setMessage(`${summaryLine(1)} "${trimmedLabel}" (${file.name}).`);
      setLabel("");
    } catch (err) {
      setError(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function uploadBatch(selectedFiles) {
    const plan = selectedFiles.map((file) => ({ file, label: vendorLabelFromFileName(file.name) }));

    const duplicateLabels = plan.map((p) => p.label).filter((l) => findExisting(l));
    if (duplicateLabels.length > 0) {
      const proceed = window.confirm(
        `${duplicateLabels.length} of these ${plan.length} files match a vendor that already has a file:\n\n${duplicateLabels.join("\n")}\n\nUploading will replace their existing mappings. Continue?`
      );
      if (!proceed) return;
    }

    setUploading(true);
    let succeeded = 0;
    const failures = [];
    for (const { file, label: derivedLabel } of plan) {
      try {
        await onUpload(derivedLabel, file);
        succeeded++;
      } catch (err) {
        failures.push({ file: file.name, reason: err.message ?? "Upload failed." });
      }
    }
    setUploading(false);

    const line = summaryLine(succeeded);
    if (failures.length === 0) {
      setMessage(line);
    } else {
      const failureText = `${failures.length} failed: ${failures.map((f) => `${f.file} (${f.reason})`).join("; ")}`;
      if (succeeded === 0) {
        setError(failureText);
      } else {
        setMessage(`${line} ${failureText}`);
      }
    }
  }

  async function handleFileChange(e) {
    const selectedFiles = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (selectedFiles.length === 0) return;

    setError(null);
    setMessage(null);

    // One file with a vendor label already typed in -> that explicit
    // single-vendor flow (name-validated against the label). Anything
    // else (multiple files, or no label typed) -> batch, where each
    // file's vendor is derived from its own filename instead.
    if (selectedFiles.length === 1 && label.trim()) {
      await uploadSingle(label.trim(), selectedFiles[0]);
    } else {
      await uploadBatch(selectedFiles);
    }
  }

  return (
    <section className="vendor-files">
      <h2>Vendor Files</h2>
      <p>
        Upload a vendor's Thread Chart as .xlsx or .pdf — one at a time with a vendor label typed in below, or select
        several files at once as a batch (each file's vendor is then taken from its own file name). Uploading under a
        label that already exists replaces that vendor's mappings with the new file, after confirming. PDF tables are
        extracted on a best-effort basis — it needs an actual text-based Thread Number / PMS Number table, not a
        scanned image or a link list.
      </p>

      <div className="vendor-files__upload">
        <div className="field">
          <label htmlFor="vendor-file-label" className="field__label">
            Vendor Label <span className="field__hint">(single upload only — leave blank for a batch)</span>
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
          {uploading ? "Uploading..." : "Upload File(s)"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.pdf"
          multiple
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
                  <td>{formatDisplayDateTime(f.uploadedAt)}</td>
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

    if (!vendorLabelMatchesFileName(file.label, newFile.name)) {
      setError(
        `"${newFile.name}" doesn't look like it belongs to "${file.label}" — double-check you picked the right file before replacing.`
      );
      return;
    }

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
            <dd>{formatDisplayDateTime(file.uploadedAt)}</dd>
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
