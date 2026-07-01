/* Client-side Web Push helpers: subscribe/unsubscribe this device to the app's
   VAPID push, talking to the backend /api/push/* endpoints. */
import { api } from "./api/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** True if this device already has a push subscription and permission. */
export async function pushEnabledLocally(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

/** Request permission, subscribe to push, and register the subscription server-side. */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) {
    throw new Error("Push notifications aren't supported on this device.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was denied.");
  }
  const reg = await navigator.serviceWorker.ready;
  const { data } = await api.get<{ public_key: string }>("/push/vapid-key");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.public_key),
    });
  }
  await api.post("/push/subscribe", { subscription: sub.toJSON() });
}

/** Unsubscribe this device and forget it server-side. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api.post("/push/unsubscribe", { endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
}
