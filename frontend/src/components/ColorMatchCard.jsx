import { useEffect, useState } from "react";
import ColorSwatch from "./ColorSwatch";
import { isValidHex, normalizeHex } from "../utils/color";
import { formatDisplayDate } from "../utils/date";
import { formatUpdatedBy } from "../utils/text";
import { getStaticChartFileUrl, isUploadedSource, getUploadedFileBlob } from "../services/colorService";

/**
 * Bundled charts are a plain static file, so a normal `<a href download>`
 * works. Admin-uploaded/PDF-converted charts live as a Blob in IndexedDB
 * instead (no URL to link to), so those need to be fetched and turned into
 * a temporary object URL on click.
 */
function DownloadChartButton({ record }) {
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const uploaded = isUploadedSource(record.sourceFile);

  if (!uploaded) {
    return (
      <a className="btn btn--primary" href={getStaticChartFileUrl(record.sourceFile)} download>
        Download Chart
      </a>
    );
  }

  async function handleClick() {
    setStatus("loading");
    const blob = await getUploadedFileBlob(record.sourceFile);
    if (!blob) {
      setStatus("error");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${record.vendor}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("idle");
  }

  return (
    <>
      <button type="button" className="btn btn--primary" onClick={handleClick} disabled={status === "loading"}>
        {status === "loading" ? "Preparing..." : "Download Chart"}
      </button>
      {status === "error" && (
        <span className="match-card__raw-empty" role="alert">
          Couldn't find this file — it may have been uploaded in a different browser.
        </span>
      )}
    </>
  );
}

/**
 * @param {{ record: import('../types').ColorMapping }} props
 */
export default function ColorMatchCard({ record }) {
  const hasPms = Boolean(record.pmsCode?.trim());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const raw = record.raw;

  // Collapse back to closed whenever a different thread is selected, so the
  // panel doesn't stay pinned open while browsing unrelated matches.
  useEffect(() => {
    setShowAdvanced(false);
  }, [record.id]);

  const rawHex =
    raw && Number.isFinite(raw.r) && Number.isFinite(raw.g) && Number.isFinite(raw.b)
      ? normalizeHex(
          "#" +
            [raw.r, raw.g, raw.b]
              .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"))
              .join("")
        )
      : "";

  return (
    <section className="match-card" aria-labelledby="match-card-heading">
      <h2 className="match-card__heading" id="match-card-heading">
        Selected Thread
      </h2>
      <p className="match-card__thread-name">
        {record.threadBrand} {record.threadCode}
        {record.threadColorName ? ` — ${record.threadColorName}` : ""}
      </p>

      <div className="match-card__swatches">
        <ColorSwatch
          hex={record.threadHex}
          label="Thread Color Preview"
          sublabel={record.threadColorName || record.threadCode}
          size="lg"
        />
        <div className="match-card__arrow" aria-hidden="true">
          →
        </div>
        {hasPms ? (
          <ColorSwatch
            hex={record.pmsHex}
            label="Monitor Display Color"
            sublabel={record.pmsName || `PMS ${record.pmsCode}`}
            size="lg"
          />
        ) : (
          <div className="color-swatch color-swatch--lg">
            <div className="color-swatch__box color-swatch__box--empty">
              <span className="color-swatch__placeholder">No PMS match</span>
            </div>
            <div className="color-swatch__meta">
              <span className="color-swatch__label">Monitor Display Color</span>
            </div>
          </div>
        )}
      </div>

      {!hasPms && (
        <p className="match-card__notice" role="status">
          An exact PMS match is not yet available for this thread.
          {record.notes ? ` ${record.notes}` : ""}
        </p>
      )}
      {hasPms && !isValidHex(record.pmsHex) && (
        <p className="match-card__notice match-card__notice--muted" role="status">
          PMS {record.pmsCode} is matched, but no Monitor Display Color has been recorded for it yet.
        </p>
      )}

      <dl className="match-card__details">
        <div>
          <dt>Vendor</dt>
          <dd>{record.vendor}</dd>
        </div>
        <div>
          <dt>Thread</dt>
          <dd>
            {record.threadBrand} {record.threadCode}
          </dd>
        </div>
        <div>
          <dt>Matched PMS</dt>
          <dd>{hasPms ? record.pmsName || `PMS ${record.pmsCode}` : "Unavailable"}</dd>
        </div>
        {record.notes && (
          <div>
            <dt>Notes</dt>
            <dd>{record.notes}</dd>
          </div>
        )}
        <div>
          <dt>Last Updated</dt>
          <dd>{formatDisplayDate(record.updatedAt)}</dd>
        </div>
        <div>
          <dt>Updated By</dt>
          <dd>{formatUpdatedBy(record.updatedBy) || "—"}</dd>
        </div>
      </dl>

      <div className="match-card__advanced">
        <button
          type="button"
          className="match-card__advanced-toggle"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          Advanced Setting
          <span className={`match-card__advanced-caret${showAdvanced ? " match-card__advanced-caret--open" : ""}`} aria-hidden="true">
            ▾
          </span>
        </button>

        {showAdvanced && (
          <div className="match-card__raw" role="region" aria-label="Original spreadsheet row">
            <p className="match-card__raw-intro">
              The row exactly as it appears in the source vendor chart — use this to double-check the match above
              against the original file.
            </p>

            {raw ? (
              <div className="match-card__raw-row-wrap">
                <table className="match-card__raw-row">
                  <thead>
                    <tr>
                      <th>Thread Name</th>
                      <th>Color Category</th>
                      <th>Thread Chart</th>
                      <th>Thread Number</th>
                      <th>Monitor Display Color</th>
                      <th>PMS Number</th>
                      <th>R</th>
                      <th>G</th>
                      <th>B</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{raw.threadName || "NA"}</td>
                      <td>{raw.colorCategory || "—"}</td>
                      <td>{raw.threadChart || "—"}</td>
                      <td>{raw.threadNumber}</td>
                      <td className="match-card__raw-color-cell">
                        {rawHex && (
                          <span
                            className="match-card__raw-color-swatch"
                            style={{ backgroundColor: rawHex }}
                            aria-hidden="true"
                          />
                        )}
                      </td>
                      <td>{raw.pmsNumber || "—"}</td>
                      <td>{raw.r ?? "—"}</td>
                      <td>{raw.g ?? "—"}</td>
                      <td>{raw.b ?? "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="match-card__raw-empty">
                No original spreadsheet row on file — this record was added or edited by hand rather than imported
                from a vendor chart.
              </p>
            )}

            <div className="match-card__raw-actions">
              {record.sourceFile ? (
                <DownloadChartButton record={record} />
              ) : (
                <span className="match-card__raw-empty">
                  Original file not available for hand-entered records.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
