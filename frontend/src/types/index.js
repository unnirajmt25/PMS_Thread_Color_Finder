/**
 * @typedef {Object} ColorMapping
 * @property {string} id
 * @property {string} vendor
 * @property {string} threadBrand
 * @property {string} threadCode
 * @property {string} [threadColorName]
 * @property {string} [threadHex]
 * @property {string} pmsCode
 * @property {string} [pmsName]
 * @property {string} [pmsHex]
 * @property {string} [notes]
 * @property {string} updatedAt
 * @property {string} [updatedBy] - who last touched this record; "Vendor
 *   Chart Import" for bulk-seeded data, the admin's login identity for
 *   anything edited through Admin.
 * @property {string} [sourceFile] - filename of the original vendor
 *   workbook this record was parsed from, servable from
 *   /thread-charts/<sourceFile>. Absent for records added or edited by
 *   hand (Admin's Add/Edit form, CSV import) since there's no source file
 *   behind those.
 * @property {RawSourceRow} [raw] - the untouched values from the original
 *   spreadsheet row, for cross-checking a match against the source chart.
 *
 * @typedef {Object} RawSourceRow
 * @property {string} threadName
 * @property {string} colorCategory
 * @property {string} threadChart
 * @property {string} threadNumber
 * @property {string} pmsNumber
 * @property {number|null} r
 * @property {number|null} g
 * @property {number|null} b
 */

export {};
