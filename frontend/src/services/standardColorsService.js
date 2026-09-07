/**
 * Read-only access to the company's "Standard Colors" reference chart
 * (name -> PMS code), generated from Thread Chart/Standerd Colors.xls by
 * scripts/generate-standard-colors.mjs.
 *
 * Deliberately a separate module from colorService.js: this is a fixed
 * reference list, not a vendor thread chart, and has nothing to do with
 * vendor/PMS thread matching — it must never be merged into, or read
 * from, the same cache as that data. There's no admin editing, no
 * localStorage/IndexedDB overlay, and no "records" here on purpose.
 */

const DATA_URL = `${import.meta.env.BASE_URL}data/standard-colors.json`;

let cache = null;

/** @returns {Promise<{ name: string, pmsCode: string }[]>} */
export async function getStandardColors() {
  if (cache) return cache;
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${DATA_URL}`);
  cache = await res.json();
  return cache;
}
