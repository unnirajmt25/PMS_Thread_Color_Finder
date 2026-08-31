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
