// Micro-benchmark of the E2EE primitives (Node WebCrypto). Measures computation cost only — NOT network latency,
// and NOT a phone: browsers on mobile hardware will differ. Run: node scripts/e2ee-bench.mjs
import * as c from "../src/lib/e2ee/crypto.ts";
import { performance } from "node:perf_hooks";

const stats = (xs) => { const s = [...xs].sort((a, b) => a - b); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { n: s.length, median: q(0.5), p95: q(0.95), min: s[0], max: s[s.length - 1] }; };
const time = async (n, fn, warm = 5) => { for (let i = 0; i < warm; i++) await fn(); const out = []; for (let i = 0; i < n; i++) { const t = performance.now(); await fn(); out.push(performance.now() - t); } return stats(out); };
const fill = (n) => { const b = new Uint8Array(n); for (let i = 0; i < n; i += 60000) crypto.getRandomValues(b.subarray(i, i + 60000)); return b; };

const res = { env: { node: process.version, platform: process.platform, arch: process.arch }, tests: {} };
const her = await c.generateIdentity(), him = await c.generateIdentity();
res.tests.keygen_ms = await time(30, () => c.generateIdentity());
res.tests.ecdh_hkdf_ms = await time(100, () => c.deriveShared(her.privateKey, him.publicKey));
const shared = await c.deriveShared(her.privateKey, him.publicKey);
const aad = c.messageAad("c", "a", "text");
res.tests.text = {};
for (const size of [20, 200, 1000, 4000]) {
  const text = "x".repeat(size);
  const enc = await time(300, () => c.encryptText(shared.msg, text, aad));
  const packed = await c.encryptText(shared.msg, text, aad);
  const dec = await time(300, () => c.decryptText(shared.msg, packed, aad));
  res.tests.text[size] = { encrypt_ms: enc, decrypt_ms: dec, plaintext_bytes: size, ciphertext_chars: packed.length, overhead_ratio: +(packed.length / size).toFixed(2) };
}
res.tests.file = {};
for (const size of [50_000, 300_000, 3_000_000]) {
  const data = fill(size);
  const enc = await time(30, () => c.encryptFile(data.buffer), 3);
  const { cipher, key } = await c.encryptFile(data.buffer);
  const dec = await time(30, () => c.decryptFile(cipher.buffer, key), 3);
  res.tests.file[size] = { encrypt_ms: enc, decrypt_ms: dec, plaintext_bytes: size, ciphertext_bytes: cipher.length, overhead_bytes: cipher.length - size };
}
const w = await c.wrapPrivate(her.pkcs8, "benchmark-passphrase");
res.tests.pbkdf2_unwrap_600k_ms = await time(8, () => c.unwrapPrivate(w.wrapped, w.salt, w.iterations, "benchmark-passphrase"), 1);
const sdp = "v=0\r\na=fingerprint:sha-256 AA:BB:CC:DD\r\nm=audio 9\r\n" + "a=x\r\n".repeat(200);
const sig = await c.signSdp(shared.mac, "call", "offer", sdp);
res.tests.sdp_sign_ms = await time(300, () => c.signSdp(shared.mac, "call", "offer", sdp));
res.tests.sdp_verify_ms = await time(300, () => c.verifySdp(shared.mac, "call", "offer", sdp, sig));
res.tests.safety_number_ms = await time(200, () => c.safetyNumber(her.publicKey, him.publicKey));
console.log(JSON.stringify(res, null, 1));
