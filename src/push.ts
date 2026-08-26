import { sendPushNotification } from "@mmmike/web-push/send";
import type { Env } from "./types";

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function sendWebPush(env: Env, subscription: PushSubscriptionData, title: string, body: string, url: string) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new Error("VAPID secrets are not configured");
  }
  return sendPushNotification(subscription, {
    title,
    body,
    icon: "/Price_radar/icon-192.png",
    badge: "/Price_radar/icon-192.png",
    tag: "price-radar",
    data: { url }
  }, {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
    ttl: 86400
  });
}
