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
