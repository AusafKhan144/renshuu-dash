/// <reference lib="webworker" />
/* Custom service worker (vite-plugin-pwa injectManifest strategy). Precaches the
   app shell and handles Web Push: shows the review reminder and, on tap, opens
   the Renshuu review queue. Excluded from the app tsconfig; vite-plugin-pwa
   compiles it on its own. */
import { clientsClaim } from "workbox-core";
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST || []);

// injectManifest doesn't add these for us (unlike generateSW). Without them a new
// worker sits "waiting" until every tab closes — which for an installed PWA never
// happens — so updates never apply. Activate immediately and take over open tabs.
self.skipWaiting();
clientsClaim();

self.addEventListener("push", (event: PushEvent) => {
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }
  const title = payload.title || "練習 Renshuu Dashboard";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus an existing window if the target is already open, else open it.
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          await client.focus();
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});
