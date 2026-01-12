import api from "../../shared/api/apiClient";

export type PushSubscriptionDto = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
  userAgent?: string | null;
  platform?: string | null;
};

export async function getVapidPublicKey(): Promise<string> {
  const { data } = await api.get("/api/push/vapid-public-key");
  if (typeof data === "string") return data;
  return data?.publicKey as string;
}

export async function subscribePush(subscription: PushSubscriptionDto): Promise<void> {
  await api.post("/api/push/subscribe", subscription);
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await api.post("/api/push/unsubscribe", { endpoint });
}

export function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);

  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    bytes[i] = rawData.charCodeAt(i);
  }

  // ✅ гарантируем, что это именно ArrayBuffer (а не ArrayBufferLike)
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return ab;
}

export function subscriptionToDto(subscription: PushSubscription): PushSubscriptionDto {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh || "",
      auth: json.keys?.auth || "",
    },
    expirationTime: subscription.expirationTime ?? null,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    platform: typeof navigator !== "undefined" ? navigator.platform : null,
  };
}
