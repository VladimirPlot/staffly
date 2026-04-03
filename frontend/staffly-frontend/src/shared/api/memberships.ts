import api from "./apiClient";
import { normalizeRestaurantRole, type RestaurantRole } from "../types/restaurant";

export type MembershipSpecialization = "EXAMINER";

export type MyMembership = {
  restaurantId: number;
  role: RestaurantRole;
  specializations: MembershipSpecialization[];
};

let cachedMemberships: MyMembership[] | null = null;
let inflight: Promise<MyMembership[]> | null = null;

function mapSpecializations(value: unknown): MembershipSpecialization[] {
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return rawValues
    .map((item) => (typeof item === "string" ? item.toUpperCase() : ""))
    .filter((item): item is MembershipSpecialization => item === "EXAMINER");
}

function mapMembership(row: any): MyMembership | null {
  const restaurantId = Number(row?.restaurantId);
  if (!Number.isFinite(restaurantId)) {
    return null;
  }

  const roleValue = normalizeRestaurantRole(row?.role ?? null);
  if (!roleValue) {
    return null;
  }

  return {
    restaurantId,
    role: roleValue,
    specializations: mapSpecializations(row?.specializations),
  };
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

export async function getMyMembershipIn(restaurantId: number): Promise<MyMembership | null> {
  if (!Number.isFinite(restaurantId)) {
    return null;
  }
  const memberships = await listMyMemberships();
  return memberships.find((m) => m.restaurantId === restaurantId) ?? null;
}

export async function getMyRoleIn(restaurantId: number): Promise<RestaurantRole | null> {
  const membership = await getMyMembershipIn(restaurantId);
  return membership?.role ?? null;
}

export function clearMembershipsCache(): void {
  cachedMemberships = null;
  inflight = null;
}
