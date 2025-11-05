const API_BASE =
  (import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") as string) ||
  "http://localhost:8080";

export function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE}${url}`;
}

export { API_BASE };
