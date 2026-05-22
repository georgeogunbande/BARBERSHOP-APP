// ─────────────────────────────────────────────────────────────────
// auth.js — FlatPurse auth helpers
// ─────────────────────────────────────────────────────────────────

import { api, setToken, clearToken } from './api.js';

/**
 * Login with email + password.
 * Stores the JWT and returns the user object on success.
 * Throws on failure.
 */
export async function login(email, password) {
  const res = await api.post('/auth/login', { email, password });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || data?.message || 'Login failed');
  if (data.token) setToken(data.token);
  return data.user ?? data;
}

/**
 * Register a new business owner account.
 * Stores the JWT and returns the user object on success.
 * Throws on failure.
 */
export async function register(businessName, city, businessType, firstName, lastName, email, password) {
  const res = await api.post('/auth/register', {
    businessName,
    city,
    businessType,
    firstName,
    lastName,
    email,
    password,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || data?.message || 'Registration failed');
  if (data.token) setToken(data.token);
  return data.user ?? data;
}

/**
 * Logout the current session.
 * Clears the stored JWT regardless of server response.
 */
export async function logout() {
  try {
    await api.post('/auth/logout', {});
  } finally {
    clearToken();
  }
}

/**
 * Fetch the current authenticated user.
 * Returns null if the request fails (e.g. token expired).
 */
export async function getMe() {
  try {
    const res = await api.get('/auth/me');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
