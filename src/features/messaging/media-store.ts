"use client";
import { useSyncExternalStore } from "react";

/**
 * The photos of the open conversation as displayable URLs (signed links, or decrypted blobs when the chat is
 * end-to-end encrypted). The conversation publishes them; the "shared media" sheet in the header reads them,
 * so it never has to sign or decrypt anything itself.
 */
let photos: string[] = [];
const listeners = new Set<() => void>();
const EMPTY: string[] = [];

export function publishPhotos(urls: string[]) {
  photos = urls;
  listeners.forEach((l) => l());
}
export const usePhotos = () =>
  useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => photos, () => EMPTY);
