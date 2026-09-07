/**
 * Formats a stored `updatedBy` value for display: an admin identity like
 * "unniraj.chathukutty@idynamics.com" shows as just "unniraj". Non-email
 * values (e.g. "Vendor Chart Import") pass through unchanged. The full
 * value is still what's stored/exported — this is presentation only.
 */
export function formatUpdatedBy(value) {
  if (!value) return "";
  if (!value.includes("@")) return value;
  const localPart = value.split("@")[0];
  return localPart.split(".")[0];
}

function normalizeVendorToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\.(xlsx|pdf)$/i, "")
    .replace(/\(\s*\d+\s*\)/g, "") // drop "(1)", "(2)" duplicate-download suffixes
    .replace(/\bthread\s*charts?\b/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Best-effort check that a vendor label and an uploaded file's name refer
 * to the same vendor — e.g. catches selecting "4imprint Thread Charts" but
 * uploading "Dunbrooke Thread Charts.xlsx". Strips the extension, generic
 * "Thread Chart(s)" wording, and "(1)"/"(2)"-style duplicate-download
 * suffixes before comparing, so re-uploading a revised copy of the same
 * vendor's own chart (a common Windows download-naming pattern) isn't
 * wrongly flagged as a mismatch.
 */
export function vendorLabelMatchesFileName(label, fileName) {
  const a = normalizeVendorToken(label);
  const b = normalizeVendorToken(fileName);
  if (!a || !b) return true; // nothing meaningful to compare - don't block
  return a.includes(b) || b.includes(a);
}

/** Derives a vendor label from an uploaded file's name for batch uploads. */
export function vendorLabelFromFileName(fileName) {
  return String(fileName ?? "").replace(/\.(xlsx|pdf)$/i, "").trim();
}
