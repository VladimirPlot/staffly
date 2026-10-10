export const TOKEN_KEY = "accessToken" as const;
const EPOCH_KEY = "staffly:auth-epoch";

export function getAuthEpoch(): string | null {
  return localStorage.getItem(EPOCH_KEY);
}

export function saveToken(token: string, newSession = false) {
  if (newSession) localStorage.setItem(EPOCH_KEY, crypto.randomUUID());
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("auth:token-changed"));
}
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(EPOCH_KEY, crypto.randomUUID());
  window.dispatchEvent(new Event("auth:token-changed"));
}
