import ColorSwatch from "./ColorSwatch";
import { formatDisplayDate } from "../utils/date";
import { formatUpdatedBy } from "../utils/text";

/**
 * @param {{
 *   records: import('../types').ColorMapping[],
 *   onEdit: (record: import('../types').ColorMapping) => void,
 *   onDelete: (record: import('../types').ColorMapping) => void,
 * }} props
 */
export default function DataTable({ records, onEdit, onDelete }) {
  const showActions = Boolean(onEdit || onDelete);

  if (records.length === 0) {
    return <p className="data-table__empty">No records match the current filters.</p>;
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Thread Brand</th>
            <th>Code</th>
            <th>Color Name</th>
            <th>Thread</th>
            <th>PMS</th>
            <th>Monitor Display Color</th>
            <th>Updated</th>
            <th>Updated By</th>
            {showActions && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.vendor}</td>
              <td>{record.threadBrand}</td>
              <td>{record.threadCode}</td>
              <td>{record.threadColorName || "—"}</td>
              <td>
                <ColorSwatch hex={record.threadHex} label="thread color" size="sm" />
              </td>
              <td>{record.pmsCode || "—"}</td>
              <td>
                <ColorSwatch hex={record.pmsHex} label="Monitor Display Color" sublabel={record.pmsName} size="sm" />
              </td>
              <td>{formatDisplayDate(record.updatedAt)}</td>
              <td>{formatUpdatedBy(record.updatedBy) || "—"}</td>
              {showActions && (
                <td className="data-table__actions">
                  {onEdit && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(record)}>
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => onDelete(record)}>
                      Delete
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
