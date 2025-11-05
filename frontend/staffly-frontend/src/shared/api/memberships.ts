import api from "./apiClient";
import { normalizeRestaurantRole, type RestaurantRole } from "../types/restaurant";

export type MyMembership = {
  restaurantId: number;
  role: RestaurantRole;
};

let cachedMemberships: MyMembership[] | null = null;
let inflight: Promise<MyMembership[]> | null = null;

function mapMembership(row: any): MyMembership | null {
  const restaurantId = Number(row?.restaurantId);
  if (!Number.isFinite(restaurantId)) {
    return null;
  }

  const roleValue = normalizeRestaurantRole(row?.role ?? null);
  if (!roleValue) {
    return null;
  }

  return { restaurantId, role: roleValue };
}

async function fetchMemberships(): Promise<MyMembership[]> {
  const { data } = await api.get("/api/me/memberships");
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(mapMembership).filter((item): item is MyMembership => item !== null);
}

export async function listMyMemberships(options?: { force?: boolean }): Promise<MyMembership[]> {
  if (!options?.force) {
    if (cachedMemberships) {
      return cachedMemberships;
    }
    if (inflight) {
      return inflight;
    }
  }

  const request = fetchMemberships()
    .then((result) => {
      cachedMemberships = result;
      inflight = null;
      return result;
    })
    .catch((error) => {
      if (!options?.force) {
        cachedMemberships = null;
        inflight = null;
      }
      throw error;
    });

  if (!options?.force) {
    inflight = request;
  }

  const memberships = await request;
  if (options?.force) {
    cachedMemberships = memberships;
  }
  return memberships;
}

export async function getMyRoleIn(restaurantId: number): Promise<RestaurantRole | null> {
  if (!Number.isFinite(restaurantId)) {
    return null;
  }
  const memberships = await listMyMemberships();
  const found = memberships.find((m) => m.restaurantId === restaurantId);
  return found?.role ?? null;
}

export function clearMembershipsCache(): void {
  cachedMemberships = null;
  inflight = null;
}
