// This is only a context hint, never evidence of authorization.
export function getTokenRestaurantId(token: string | null): number | undefined {
  try {
    if (!token) return undefined;
    const payload = token.split(".")[1];
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    const id = claims.restaurantId;
    return Number.isSafeInteger(id) && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}
