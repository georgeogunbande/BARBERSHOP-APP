// ─────────────────────────────────────────────────────────────────
// api.js — FlatPurse API client
// ─────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:5000";
const TOKEN_KEY = "access_token";

// ── Token helpers ────────────────────────────────────────────────
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Core request ─────────────────────────────────────────────────
async function request(method, path, body) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
  }

  return res;
}

// ── Exported api object ──────────────────────────────────────────
export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  patch: (path, body) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path),
};
