/**
 * Client-side admin gate for the Admin page.
 *
 * IMPORTANT: this app has no backend/server — everything runs in the
 * browser. This is NOT real security: the credentials below ship in the
 * app's JS bundle in plain text, so anyone who opens DevTools can read
 * them or simply flip the "authenticated" flag directly. It only keeps
 * casual/well-intentioned users out of the Admin page (add/edit/delete
 * mappings, vendor file uploads, CSV import). Real security would require
 * a backend or an auth provider (Firebase Auth, Supabase Auth, etc.)
 * validating credentials server-side.
 */

const ADMIN_USERNAME = "unniraj.chathukutty@idynamics.com";
const ADMIN_PASSWORD = "Unni123";

const AUTH_KEY = "thred-finder-admin-auth-v1";

export function isAdminAuthenticated() {
  try {
    return window.sessionStorage.getItem(AUTH_KEY) === "true";
  } catch {
    return false;
  }
}

export function loginAdmin(username, password) {
  const ok = username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD;
  if (ok) {
    try {
      window.sessionStorage.setItem(AUTH_KEY, "true");
    } catch {
      // sessionStorage unavailable (private browsing, etc.) — login still
      // "succeeds" for this call, but won't survive a reload.
    }
  }
  return ok;
}

export function logoutAdmin() {
  try {
    window.sessionStorage.removeItem(AUTH_KEY);
  } catch {
    // ignore
  }
}
