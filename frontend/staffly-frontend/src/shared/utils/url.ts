const envBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") as string | undefined;
const browserOrigin = typeof window !== "undefined" ? window.location.origin : undefined;

const API_BASE = envBase && envBase.length > 0 ? envBase : browserOrigin || "http://localhost:8080";

export function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE}${url}`;
}

export { API_BASE };
