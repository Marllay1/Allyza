/* Allyza service worker.
 * Caching policy — deliberately narrow:
 *   • Only the offline shell and immutable static assets are cached.
 *   • Pages, API calls, Supabase traffic, signed photo URLs are NEVER cached,
 *     so no health data or private photo ever lands in Cache Storage.
 * Push payloads carry a "kind" and a language only — never message content. */
const VERSION = "allyza-v5";
const SHELL = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/brand/mark-dark.png", "/brand/mark-light.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const STATIC = /^\/(_next\/static|icons|brand|sounds)\//;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, fonts, etc.: straight to network

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline")));
    return;
  }
  if (STATIC.test(url.pathname)) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req);
        const net = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
  }
});

// {name} is the sender as the RECIPIENT calls them (their own nickname). Never any message content.
const COPY = {
  fr: {
    journal: "Quelqu’un a écrit dans votre carnet",
    media: "Un nouveau souvenir vous attend",
    refuge: "Un petit mot vous attend dans le Refuge",
    little: "Une petite attention vous attend",
    surprise: "Une petite surprise vous attend",
    message: "{name} vous a écrit",
    call: "{name} vous appelle",
    missed_call: "Appel manqué de {name}",
  },
  en: {
    journal: "Someone wrote in your journal",
    media: "A new memory is waiting for you",
    refuge: "A little note is waiting for you in the Refuge",
    little: "A little something is waiting for you",
    surprise: "A little surprise is waiting for you",
    message: "{name} sent you a message",
    call: "{name} is calling you",
    missed_call: "Missed call from {name}",
  },
};
const FALLBACK_NAME = { fr: "Quelqu’un", en: "Someone" };
const TARGET = { journal: "/us/journal", media: "/us/memories", refuge: "/refuge/messages", little: "/us/little", surprise: "/us/surprises", message: "/messages/chat", call: "/messages/chat", missed_call: "/messages/chat" };

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {}
  const lang = data.lang === "en" ? "en" : "fr";
  const kind = COPY[lang][data.kind] ? data.kind : "journal";
  const body = COPY[lang][kind].replace("{name}", data.name || FALLBACK_NAME[lang]);
  const isCall = kind === "call";
  // Calls and their "missed" follow-up share one tag, so the missed-call notice replaces the ringing one.
  const tag = kind === "call" || kind === "missed_call" ? "allyza-call" : "allyza-" + kind;
  e.waitUntil((async () => {
    // Already looking at the conversation: the message appears there, a banner on top of it would be noise.
    if (kind === "message") {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (open.some((c) => c.visibilityState === "visible" && c.focused !== false && new URL(c.url).pathname.startsWith("/messages/chat"))) return;
    }
    return self.registration.showNotification("Allyza", {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-48.png",
      tag,
      renotify: true,
      // A ringing call stays on screen until answered or dismissed, and buzzes.
      requireInteraction: isCall,
      vibrate: isCall ? [300, 150, 300, 150, 300, 150, 300] : [120],
      data: { url: TARGET[kind], kind, callId: data.callId || null, sentAt: Date.now() },
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/home";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      for (const c of list) {
        if (!("focus" in c)) continue;
        try {
          await c.focus();
          // Same-origin navigation; if the browser refuses, fall through and open a window instead.
          if ("navigate" in c) await c.navigate(url);
          return;
        } catch {}
      }
      return self.clients.openWindow(url);
    }),
  );
});
