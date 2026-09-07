/**
 * Formats a stored ISO date ("YYYY-MM-DD") for display as "DD-MM-YYYY".
 * Data is kept in ISO form everywhere else (storage, sorting, CSV
 * import/export) — this is purely a presentation-layer conversion.
 */
export function formatDisplayDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}-${month}-${year}`;
}

/**
 * Formats a stored ISO datetime for display as "DD-MM-YYYY HH:MM" (local
 * time). Falls back to `formatDisplayDate` for older date-only values
 * ("YYYY-MM-DD", no time component) written before vendor-file uploads
 * started storing a full timestamp.
 */
export function formatDisplayDateTime(isoDateTime) {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return formatDisplayDate(isoDateTime);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}
