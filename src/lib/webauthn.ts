"use client";

const toB64u = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64u = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

/** True only when the device really offers a built-in biometric / screen-lock authenticator to this page. */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return typeof window !== "undefined" && !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}

/** Creates a device-bound passkey. The system shows Face ID / Touch ID / fingerprint; Allyza sees none of it. */
export async function createPasskey(o: { challenge: string; userId: string; name: string; rpId: string }) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: fromB64u(o.challenge),
      rp: { name: "Allyza", id: o.rpId },
      user: { id: new TextEncoder().encode(o.userId), name: o.name, displayName: o.name },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new DOMException("cancelled", "NotAllowedError");
  const res = cred.response as AuthenticatorAttestationResponse;
  const spki = res.getPublicKey();
  if (!spki) throw new DOMException("no key", "NotSupportedError");
  return { credentialId: toB64u(cred.rawId), publicKey: toB64(spki), clientDataJSON: toB64u(res.clientDataJSON) };
}

export async function getPasskeyAssertion(o: { challenge: string; credentialIds: string[]; rpId: string }) {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: fromB64u(o.challenge),
      rpId: o.rpId,
      allowCredentials: o.credentialIds.map((id) => ({ type: "public-key" as const, id: fromB64u(id), transports: ["internal" as const] })),
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new DOMException("cancelled", "NotAllowedError");
  const res = cred.response as AuthenticatorAssertionResponse;
  return {
    credentialId: toB64u(cred.rawId),
    clientDataJSON: toB64u(res.clientDataJSON),
    authenticatorData: toB64u(res.authenticatorData),
    signature: toB64u(res.signature),
  };
}

/** Marks this browsing session as already unlocked, so a fresh unlock isn't immediately treated as a cold start. */
export const SESSION_KEY = "allyza.session";
export const markSessionAlive = () => { try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* private mode */ } };
