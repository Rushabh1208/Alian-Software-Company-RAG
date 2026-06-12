import { decodeJwt, isTokenExpired, loadStoredAuth } from "./api";

export function getAuthSnapshot() {
  return loadStoredAuth();
}

export function hasValidToken(token) {
  return Boolean(token) && !isTokenExpired(token);
}

export function getRoleFromToken(token) {
  return decodeJwt(token)?.role || null;
}
