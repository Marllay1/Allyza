"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppIcon, type IconName } from "@/components/icons";

export type WelcomeCard = { icon: IconName; tint: string; eyebrow: string; title: string; text: string };

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Horizontal carousel of the three worlds.
 *  - native scroll-snap → real touch inertia and swipe on phones;
 *  - mouse drag on desktop with a slow, eased settle;
 *  - depth: the centred card is sharp at full scale, its neighbours sit smaller, softer and slightly blurred;
 *  - a gentle auto-advance that stops the moment someone touches it (and never runs with reduced motion).
 */
export function WelcomeCarousel({ cards, labels }: { cards: WelcomeCard[]; labels: { region: string; prev: string; next: string; goTo: string } }) {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const state = useRef({ paused: false, resumeAt: 0, tween: 0, dragging: false, startX: 0, startLeft: 0, moved: 0 });

  const centreOf = (el: HTMLElement, i: number) => {
    const card = el.children[i] as HTMLElement;
    return card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2;
  };

  const tweenTo = useCallback((left: number, ms = 950) => {
    const el = track.current;
    if (!el) return;
    cancelAnimationFrame(state.current.tween);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { el.scrollTo({ left }); return; }
    const from = el.scrollLeft, dist = left - from, t0 = performance.now();
    el.dataset.tween = "true";
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      el.scrollLeft = from + dist * easeInOut(p);
      if (p < 1) state.current.tween = requestAnimationFrame(step);
      else delete el.dataset.tween;
    };
    state.current.tween = requestAnimationFrame(step);
  }, []);

  const goTo = useCallback((i: number, ms?: number) => {
    const el = track.current;
    if (!el) return;
    tweenTo(centreOf(el, (i + cards.length) % cards.length), ms);
  }, [cards.length, tweenTo]);

  const interact = () => { state.current.paused = true; state.current.resumeAt = Date.now() + 14_000; cancelAnimationFrame(state.current.tween); if (track.current) delete track.current.dataset.tween; };

  // Depth effect, driven by scroll position (one rAF per frame, only CSS variables are written).
  useEffect(() => {
    const el = track.current, root = wrap.current;
    if (!el || !root) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const box = el.getBoundingClientRect();
      const mid = box.left + box.width / 2;
      let best = 0, bestDist = Infinity;
      Array.from(el.children).forEach((c, i) => {
        const r = (c as HTMLElement).getBoundingClientRect();
        const d = (r.left + r.width / 2 - mid) / r.width;
        (c as HTMLElement).style.setProperty("--d", d.toFixed(3));
        (c as HTMLElement).style.setProperty("--a", Math.min(1, Math.abs(d)).toFixed(3));
        if (Math.abs(d) < bestDist) { bestDist = Math.abs(d); best = i; }
      });
      setActive(best);
      const max = el.scrollWidth - el.clientWidth;
      root.style.setProperty("--p", (max > 0 ? el.scrollLeft / max : 0).toFixed(3));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => { el.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Gentle auto-advance.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const s = state.current;
      if (document.visibilityState !== "visible" || s.dragging) return;
      if (s.paused) { if (Date.now() < s.resumeAt) return; s.paused = false; }
      goTo(active + 1, 1300);
    }, 6500);
    return () => clearInterval(id);
  }, [active, goTo]);

  // Mouse drag (touch uses native scrolling).
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = track.current!; const s = state.current;
    interact(); s.dragging = true; s.startX = e.clientX; s.startLeft = el.scrollLeft; s.moved = 0;
    el.dataset.drag = "true"; el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = state.current; if (!s.dragging) return;
    s.moved = e.clientX - s.startX; track.current!.scrollLeft = s.startLeft - s.moved;
  };
  const endDrag = () => {
    const s = state.current; const el = track.current!; if (!s.dragging) return;
    s.dragging = false; delete el.dataset.drag;
    const dir = Math.abs(s.moved) > 60 ? (s.moved < 0 ? 1 : -1) : 0;
    goTo(active + dir, 800);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); interact(); goTo(active + 1, 800); }
    if (e.key === "ArrowLeft") { e.preventDefault(); interact(); goTo(active - 1, 800); }
  };

  return (
    <div ref={wrap} className="relative" style={{ ["--p" as string]: 0 }}>
      {/* soft background light that drifts with the cards */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="wc-orb" style={{ width: 260, height: 260, left: "8%", top: "10%", background: "var(--rose)", transform: "translate3d(calc(var(--p) * -60px), 0, 0)" }} />
        <span className="wc-orb" style={{ width: 300, height: 300, right: "4%", bottom: "0", background: "var(--mauve)", transform: "translate3d(calc(var(--p) * 70px), 0, 0)" }} />
      </div>

      <div
        ref={track}
        className="wc-track"
        role="region"
        aria-roledescription="carousel"
        aria-label={labels.region}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onTouchStart={interact}
        onWheel={interact}
      >
        {cards.map((c, i) => (
          <article key={c.title} className="wc-card" aria-roledescription="slide" aria-label={`${i + 1} / ${cards.length}`} style={{ ["--tint" as string]: c.tint }}>
            <div className="wc-card-inner">
              <span className="grid place-items-center size-14 rounded-full border border-[var(--glass-line)] bg-[color-mix(in_srgb,var(--tint)_22%,var(--surface))]">
                <AppIcon name={c.icon} size={26} className="text-ink" />
              </span>
              <div className="relative z-10">
                <p className="eyebrow mb-2">{c.eyebrow}</p>
                <h2 className="text-[2rem] leading-tight">{c.title}</h2>
                <p className="mt-3 text-muted text-balance">{c.text}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="relative z-10 flex items-center justify-center gap-3 -mt-2">
        <button className="icon-btn text-muted" aria-label={labels.prev} onClick={() => { interact(); goTo(active - 1, 900); }}><AppIcon name="back" size={20} /></button>
        <div className="flex items-center gap-2">
          {cards.map((c, i) => (
            <button key={c.title} className="wc-dot" aria-label={`${labels.goTo} ${i + 1}`} aria-current={i === active} onClick={() => { interact(); goTo(i, 1000); }} />
          ))}
        </div>
        <button className="icon-btn text-muted" aria-label={labels.next} onClick={() => { interact(); goTo(active + 1, 900); }}><AppIcon name="forward" size={20} /></button>
      </div>
    </div>
  );
}
