/**
 * End-to-end encryption primitives (WebCrypto only — no dependency, runs in browsers and Node).
 *
 *  identity   ECDH P-256 key pair made on the device. Public key is shared; the private key is only ever
 *             stored wrapped (PBKDF2 → AES-GCM) on the server and as a NON-extractable key on the device.
 *  shared     ECDH(mine, theirs) → HKDF-SHA256 → one AES-GCM key for messages and one HMAC key for calls.
 *  messages   AES-GCM, random 96-bit IV per message, the message's context (couple|author|kind) as AAD so a
 *             ciphertext cannot be moved to another message, author or kind. Packed as "1.<base64(iv‖ct)>".
 *  files      A fresh random AES-GCM key per photo / voice note; that key travels inside an encrypted message.
 *  calls      HMAC over the DTLS fingerprints of an SDP, so a signalling server cannot swap them (man-in-the-middle).
 *
 * Honest limits: static-static ECDH means no forward secrecy (a stolen private key opens past messages),
 * and metadata (who, when, kind, size) is not hidden. Keep this file free of imports so scripts can test it.
 */
export const KDF_ITERATIONS = 600_000;

const te = new TextEncoder();
const td = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

export const b64 = (data: ArrayBuffer | Uint8Array): string => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const rand = (n: number): Uint8Array<ArrayBuffer> => globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));
const concat = (a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(a.length + b.length));
  out.set(a); out.set(b, a.length);
  return out;
};

/* ── identity ─────────────────────────────────────────────────────────── */

export async function generateIdentity(): Promise<{ privateKey: CryptoKey; publicKey: string; pkcs8: Uint8Array }> {
  const pair = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicKey = b64(await subtle().exportKey("raw", pair.publicKey));
  const pkcs8 = new Uint8Array(await subtle().exportKey("pkcs8", pair.privateKey));
  // Re-import as non-extractable: the copy kept on the device cannot be read back out by scripts.
  const privateKey = await importPrivate(pkcs8);
  return { privateKey, publicKey, pkcs8 };
}

const importPrivate = (pkcs8: Uint8Array<ArrayBuffer> | Uint8Array) =>
  subtle().importKey("pkcs8", pkcs8 as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
const importPublic = (pub: string) =>
  subtle().importKey("raw", unb64(pub), { name: "ECDH", namedCurve: "P-256" }, false, []);

async function passphraseKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await subtle().importKey("raw", te.encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Wraps the private key under a passphrase so a new device can restore it. The server only ever sees this. */
export async function wrapPrivate(pkcs8: Uint8Array, passphrase: string, iterations = KDF_ITERATIONS) {
  const salt = rand(16);
  const iv = rand(12);
  const key = await passphraseKey(passphrase, salt, iterations);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, key, pkcs8 as BufferSource));
  return { wrapped: b64(concat(iv, ct)), salt: b64(salt), iterations };
}

/** Throws Error("wrong_passphrase") when the passphrase does not open the wrapped key. */
export async function unwrapPrivate(wrapped: string, salt: string, iterations: number, passphrase: string): Promise<CryptoKey> {
  const raw = unb64(wrapped);
  const key = await passphraseKey(passphrase, unb64(salt), iterations);
  let pkcs8: ArrayBuffer;
  try {
    pkcs8 = await subtle().decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12));
  } catch {
    throw new Error("wrong_passphrase");
  }
  return importPrivate(new Uint8Array(pkcs8));
}

/* ── shared keys ──────────────────────────────────────────────────────── */

export type Shared = { msg: CryptoKey; mac: CryptoKey };

export async function deriveShared(myPrivate: CryptoKey, theirPublic: string): Promise<Shared> {
  const bits = await subtle().deriveBits({ name: "ECDH", public: await importPublic(theirPublic) }, myPrivate, 256);
  const base = await subtle().importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const salt = te.encode("allyza-e2ee-v1");
  const msg = await subtle().deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: te.encode("messages") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const mac = await subtle().deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: te.encode("call-signalling") }, base, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign", "verify"]);
  return { msg, mac };
}

/* ── messages ─────────────────────────────────────────────────────────── */

export async function encryptText(key: CryptoKey, plaintext: string, aad: string): Promise<string> {
  const iv = rand(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv, additionalData: te.encode(aad) }, key, te.encode(plaintext)));
  return "1." + b64(concat(iv, ct));
}

export async function decryptText(key: CryptoKey, packed: string, aad: string): Promise<string> {
  if (!packed.startsWith("1.")) throw new Error("unknown_format");
  const raw = unb64(packed.slice(2));
  const pt = await subtle().decrypt({ name: "AES-GCM", iv: raw.slice(0, 12), additionalData: te.encode(aad) }, key, raw.slice(12));
  return td.decode(pt);
}

/** The context bound into every message ciphertext. */
export const messageAad = (coupleId: string, authorId: string, kind: string) => `${coupleId}|${authorId}|${kind}`;

/* ── files (photos, voice notes) ──────────────────────────────────────── */

export async function encryptFile(bytes: ArrayBuffer): Promise<{ cipher: Uint8Array<ArrayBuffer>; key: string }> {
  const raw = rand(32);
  const key = await subtle().importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = rand(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, key, bytes));
  return { cipher: concat(iv, ct), key: b64(raw) };
}

export async function decryptFile(cipher: ArrayBuffer, fileKey: string): Promise<ArrayBuffer> {
  const key = await subtle().importKey("raw", unb64(fileKey), { name: "AES-GCM" }, false, ["decrypt"]);
  const data = new Uint8Array(cipher);
  return subtle().decrypt({ name: "AES-GCM", iv: data.slice(0, 12) }, key, data.slice(12));
}

/* ── verification ─────────────────────────────────────────────────────── */

/** A 60-digit number both people can compare (read aloud, side by side): identical on both phones iff the keys match. */
export async function safetyNumber(publicA: string, publicB: string): Promise<string> {
  const [first, second] = [publicA, publicB].sort();
  const digest = new Uint8Array(await subtle().digest("SHA-256", te.encode(`allyza-safety-v1|${first}|${second}`)));
  const view = new DataView(digest.buffer);
  const groups: string[] = [];
  for (let i = 0; i < 6; i++) groups.push(String(view.getUint32(i * 4) % 100000).padStart(5, "0"));
  for (let i = 0; i < 6; i++) groups.push(String(view.getUint32(i * 4 + 2) % 100000).padStart(5, "0"));
  return groups.join(" ");
}

/** Short stable id of a public key, used to notice when the other person's key changes. */
export async function keyFingerprint(publicKey: string): Promise<string> {
  const digest = new Uint8Array(await subtle().digest("SHA-256", te.encode(publicKey)));
  return b64(digest.subarray(0, 12));
}

/* ── call signalling ──────────────────────────────────────────────────── */

const dtlsFingerprints = (sdp: string) => [...sdp.matchAll(/^a=fingerprint:(\S+ \S+)/gim)].map((m) => m[1].toLowerCase()).sort().join(",");

/** Binds the DTLS fingerprints of an offer/answer to this call and role, with a key only the two people share. */
export async function signSdp(mac: CryptoKey, callId: string, role: "offer" | "answer", sdp: string): Promise<string> {
  const sig = await subtle().sign("HMAC", mac, te.encode(`${callId}|${role}|${dtlsFingerprints(sdp)}`));
  return b64(sig);
}

export async function verifySdp(mac: CryptoKey, callId: string, role: "offer" | "answer", sdp: string, signature: string): Promise<boolean> {
  try {
    return await subtle().verify("HMAC", mac, unb64(signature), te.encode(`${callId}|${role}|${dtlsFingerprints(sdp)}`));
  } catch {
    return false;
  }
}
