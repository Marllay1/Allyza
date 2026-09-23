import { createHash, createPublicKey, verify } from "node:crypto";

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url");

export type AssertionInput = {
  clientDataJSON: string; // base64url
  authenticatorData: string; // base64url
  signature: string; // base64url
};

/**
 * Verifies a WebAuthn assertion produced by a platform authenticator (Face ID, Touch ID, Android
 * biometrics, Windows Hello) against the public key stored at registration. The biometric check
 * itself happens inside the device; this proves the device's key signed OUR challenge, on OUR
 * origin, with user verification performed.
 */
export function verifyAssertion(opts: {
  input: AssertionInput;
  publicKeySpkiB64: string;
  expectedChallenge: string; // base64url
  expectedOrigin: string;
  rpId: string;
}): boolean {
  try {
    const clientDataBytes = Buffer.from(opts.input.clientDataJSON, "base64url");
    const clientData = JSON.parse(clientDataBytes.toString("utf8")) as { type?: string; challenge?: string; origin?: string };
    if (clientData.type !== "webauthn.get" || clientData.challenge !== opts.expectedChallenge || clientData.origin !== opts.expectedOrigin) return false;

    const authData = Buffer.from(opts.input.authenticatorData, "base64url");
    if (authData.length < 37) return false;
    if (!authData.subarray(0, 32).equals(createHash("sha256").update(opts.rpId).digest())) return false;
    const flags = authData[32];
    if (!(flags & 0x01) || !(flags & 0x04)) return false; // user present AND user verified (the biometric/PIN check)

    const signedData = Buffer.concat([authData, createHash("sha256").update(clientDataBytes).digest()]);
    const key = createPublicKey({ key: Buffer.from(opts.publicKeySpkiB64, "base64"), format: "der", type: "spki" });
    return verify("sha256", signedData, key, Buffer.from(opts.input.signature, "base64url"));
  } catch {
    return false;
  }
}

/** Checks the registration ceremony's client data (the attestation itself is not needed: we only keep the key). */
export function verifyRegistrationClientData(clientDataJSON: string, expectedChallenge: string, expectedOrigin: string): boolean {
  try {
    const cd = JSON.parse(Buffer.from(clientDataJSON, "base64url").toString("utf8")) as { type?: string; challenge?: string; origin?: string };
    return cd.type === "webauthn.create" && cd.challenge === expectedChallenge && cd.origin === expectedOrigin;
  } catch {
    return false;
  }
}

export { b64u };
