// Round-trip and tamper tests for the end-to-end encryption primitives. Run: npm run test:e2ee
import * as c from "../src/lib/e2ee/crypto.ts";

let failed = false;
const check = (label, cond) => { console.log(cond ? "ok  " : "FAIL", label); if (!cond) failed = true; };
const throwsAsync = async (label, fn) => { try { await fn(); check(label, false); } catch { check(label, true); } };

const her = await c.generateIdentity();
const him = await c.generateIdentity();
const eve = await c.generateIdentity();

// Both sides derive the same keys; a stranger cannot.
const herShared = await c.deriveShared(her.privateKey, him.publicKey);
const himShared = await c.deriveShared(him.privateKey, her.publicKey);
const eveShared = await c.deriveShared(eve.privateKey, her.publicKey);

const aad = c.messageAad("couple-1", "her-id", "text");
const packed = await c.encryptText(herShared.msg, "Je t'aime 💜 — un long message ".repeat(80), aad);
check("ciphertext does not contain the plaintext", !packed.includes("aime"));
check("partner decrypts what she wrote", (await c.decryptText(himShared.msg, packed, aad)).startsWith("Je t'aime 💜"));
await throwsAsync("a stranger cannot decrypt", () => c.decryptText(eveShared.msg, packed, aad));
await throwsAsync("ciphertext cannot be moved to another author", () => c.decryptText(himShared.msg, packed, c.messageAad("couple-1", "him-id", "text")));
await throwsAsync("ciphertext cannot be moved to another kind", () => c.decryptText(himShared.msg, packed, c.messageAad("couple-1", "her-id", "sticker")));
const tampered = packed.slice(0, -6) + (packed.endsWith("AAAAAA") ? "BBBBBB" : "AAAAAA");
await throwsAsync("a modified ciphertext is rejected", () => c.decryptText(himShared.msg, tampered, aad));
check("two encryptions of the same text differ (random IV)", (await c.encryptText(herShared.msg, "x", aad)) !== (await c.encryptText(herShared.msg, "x", aad)));

// Files: per-file key, round trip, tamper.
const photo = new Uint8Array(300_000); for (let i = 0; i < photo.length; i += 60_000) crypto.getRandomValues(photo.subarray(i, i + 60_000));
const { cipher, key } = await c.encryptFile(photo.buffer);
check("encrypted file is not the file", Buffer.compare(Buffer.from(cipher.subarray(12, 100)), Buffer.from(photo.subarray(0, 88))) !== 0);
check("file round-trips", Buffer.compare(Buffer.from(await c.decryptFile(cipher.buffer, key)), Buffer.from(photo)) === 0);
const bad = cipher.slice(); bad[500] ^= 1;
await throwsAsync("a modified file is rejected", () => c.decryptFile(bad.buffer, key));

// Private key backup: right passphrase restores it, wrong one does not.
const w = await c.wrapPrivate(her.pkcs8, "correct horse battery", 100_000);
const restored = await c.unwrapPrivate(w.wrapped, w.salt, w.iterations, "correct horse battery");
const again = await c.deriveShared(restored, him.publicKey);
check("restored key derives the same shared key", (await c.decryptText(again.msg, packed, aad)).length > 100);
await throwsAsync("wrong passphrase is refused", () => c.unwrapPrivate(w.wrapped, w.salt, w.iterations, "wrong passphrase"));
check("wrapped key does not contain the raw key", !w.wrapped.includes(c.b64(her.pkcs8).slice(0, 20)));

// Safety number: identical on both phones, different with a stranger.
const n1 = await c.safetyNumber(her.publicKey, him.publicKey);
const n2 = await c.safetyNumber(him.publicKey, her.publicKey);
const n3 = await c.safetyNumber(her.publicKey, eve.publicKey);
check("safety number is the same on both phones", n1 === n2);
check("safety number has 12 groups of 5 digits", /^(\d{5} ){11}\d{5}$/.test(n1));
check("safety number changes with another key", n1 !== n3);

// Call signalling: fingerprints are authenticated.
const sdp = "v=0\r\na=fingerprint:sha-256 AA:BB:CC\r\nm=audio 9\r\n";
const sig = await c.signSdp(herShared.mac, "call-1", "offer", sdp);
check("partner verifies her offer", await c.verifySdp(himShared.mac, "call-1", "offer", sdp, sig));
check("swapped DTLS fingerprint is detected", !(await c.verifySdp(himShared.mac, "call-1", "offer", sdp.replace("AA:BB:CC", "11:22:33"), sig)));
check("an offer signature is not valid as an answer", !(await c.verifySdp(himShared.mac, "call-1", "answer", sdp, sig)));
check("signature is bound to the call id", !(await c.verifySdp(himShared.mac, "call-2", "offer", sdp, sig)));
check("a stranger's signature is rejected", !(await c.verifySdp(himShared.mac, "call-1", "offer", sdp, await c.signSdp(eveShared.mac, "call-1", "offer", sdp))));
check("garbage signature is rejected", !(await c.verifySdp(himShared.mac, "call-1", "offer", sdp, "not-base64!")));

console.log(failed ? "\nSOME E2EE CHECKS FAILED" : "\nALL E2EE CHECKS PASSED");
process.exitCode = failed ? 1 : 0;
