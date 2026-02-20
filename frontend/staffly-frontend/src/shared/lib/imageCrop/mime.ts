const IMAGE_JPEG_SET = new Set(["image/jpeg", "image/jpg"]);

export const AVATAR_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
export const TRAINING_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export function normalizeContentType(ct?: string | null): string | null {
  if (!ct) return null;
  const trimmed = ct.trim().toLowerCase();
  const value = trimmed.split(";")[0]?.trim() ?? "";
  if (!value) return null;
  if (IMAGE_JPEG_SET.has(value)) return "image/jpeg";
  return value;
}

export function isAllowedMimeType(ct: string | null | undefined, allowedSet: Set<string>): boolean {
  const normalized = normalizeContentType(ct);
  if (!normalized) return false;
  if (allowedSet.has(normalized)) return true;
  return normalized === "image/jpeg" && allowedSet.has("image/jpg");
}

export function supportsWebp(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

export function pickOutputMimeType({
  supportsWebp: canEncodeWebp,
  backendAllowsWebp,
  fallback,
}: {
  supportsWebp: boolean;
  backendAllowsWebp: boolean;
  fallback: "image/jpeg" | "image/png";
}): "image/webp" | "image/jpeg" | "image/png" {
  if (canEncodeWebp && backendAllowsWebp) {
    return "image/webp";
  }
  return fallback;
}
