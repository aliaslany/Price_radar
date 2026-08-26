import type { Env } from "./types";

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function hkdf(ikm: ArrayBuffer, salt: ArrayBuffer, info: ArrayBuffer, length = 32) {
  const base = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, base, length * 8));
}

export async function sendWebPush(env: Env, endpoint: string, p256dh: string, auth: string, payload: string) {
  const privateKey = env.VAPID_PRIVATE_KEY;
  const publicKey = env.VAPID_PUBLIC_KEY;
  if (!privateKey || !publicKey) return;
  const endpointUrl = new URL(endpoint);
  const aud = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const encode = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));
  const unsigned = `${encode(header)}.${encode({ aud, exp: now + 12 * 60 * 60, sub: env.VAPID_SUBJECT || "mailto:admin@example.com" })}`;
  const rawPrivate = unb64url(privateKey);
  const key = await crypto.subtle.importKey("raw", rawPrivate, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned)));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const clientPublic = unb64url(p256dh);
  const clientAuth = unb64url(auth);
  const serverPublic = unb64url(publicKey);
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const ephPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  const ephPrivate = ephemeral.privateKey;
  const clientKey = await crypto.subtle.importKey("raw", clientPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, ephPrivate, 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdf(shared, clientAuth.buffer, new TextEncoder().encode("WebPush: info\0" + String.fromCharCode(...clientPublic) + String.fromCharCode(...ephPublic)).buffer);
  const cek = await hkdf(prk.buffer, salt.buffer, new TextEncoder().encode("Content-Encoding: aes128gcm\0").buffer, 16);
  const nonce = await hkdf(prk.buffer, salt.buffer, new TextEncoder().encode("Content-Encoding: nonce\0").buffer, 12);
  const plaintext = new TextEncoder().encode(payload + "\0");
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, plaintext));
  const body = new Uint8Array(21 + encrypted.length);
  body.set(salt, 0); body.set(new Uint8Array(new Uint32Array([4096]).buffer).reverse(), 16); body[20] = ephPublic.length; body.set(ephPublic, 21); body.set(encrypted, 21 + ephPublic.length);
  const res = await fetch(endpoint, { method: "POST", headers: { TTL: "86400", "Content-Type": "application/octet-stream", "Content-Encoding": "aes128gcm", Authorization: `vapid t=${jwt}, k=${b64url(serverPublic)}` }, body });
  if (!res.ok) throw new Error(`Push failed: ${res.status}`);
}
