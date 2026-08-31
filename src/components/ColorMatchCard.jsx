import ColorSwatch from "./ColorSwatch";
import { isValidHex } from "../utils/color";
import { formatDisplayDate } from "../utils/date";

/**
 * @param {{ record: import('../types').ColorMapping }} props
 */
export default function ColorMatchCard({ record }) {
  const hasPms = Boolean(record.pmsCode?.trim());

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
      </dl>
    </section>
  );
}
