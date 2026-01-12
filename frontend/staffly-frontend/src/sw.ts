/// <reference lib="webworker" />
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(({ request }) => request.mode === "navigate", createHandlerBoundToURL("/index.html"));
registerRoute(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());
registerRoute(({ url }) => url.pathname.startsWith("/static/"), new NetworkOnly());

self.addEventListener("push", (event) => {
  const data = (() => {
    try {
      return event.data?.json() ?? {};
    } catch {
      return {};
    }
  })();

  const title = data.title || "Staffly";
  const body = data.body || "";
  const tag = data.tag || undefined;
  const payload = {
    url: data.url,
    rid: data.rid,
    to: data.to,
    mid: data.mid,
  };

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: payload,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = (event.notification.data || {}) as {
    url?: string;
    rid?: number | string;
    to?: string;
    mid?: number | string;
  };

  const fallbackUrl = () => {
    const to = data.to || "/inbox";
    const rid = data.rid ? Number(data.rid) : undefined;
    const mid = data.mid ? Number(data.mid) : undefined;
    if (rid) {
      const url = new URL("/push", self.location.origin);
      url.searchParams.set("rid", String(rid));
      url.searchParams.set("to", to);
      if (mid) url.searchParams.set("mid", String(mid));
      return url.toString();
    }
    return new URL(to, self.location.origin).toString();
  };

  const targetUrl = data.url ? new URL(data.url, self.location.origin).toString() : fallbackUrl();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
