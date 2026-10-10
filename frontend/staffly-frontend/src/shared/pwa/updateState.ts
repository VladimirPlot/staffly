export type UpdateState = {
  status: "idle" | "checking" | "downloading" | "ready" | "applying" | "error";
  ready: boolean;
  currentVersion: string;
  availableVersion: string | null;
  lastCheckedAt: number | null;
  error: string | null;
};

export function canOfferUpdate(
  registration: Pick<ServiceWorkerRegistration, "waiting" | "active">,
  controllerChanged = false,
): boolean {
  return controllerChanged || !!(registration.waiting && registration.active);
}
