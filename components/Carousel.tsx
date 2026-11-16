"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Bildekarusell med dybde: kortet i midten er rett og stort, kortene ved
 * siden av vipper bakover. Scroll-snap gir naturlig sveip på mobil og
 * styreflate; pilene, tastaturet og automatisk visning bruker samme scroll.
 *
 * Bytt plassholderne med ekte bilder ved å sette `src` (legg filene i
 * public/carousel/). Bildene fra Smart Elektro kommer her.
 */
export interface Slide {
  title: string;
  place?: string;
  src?: string;
  /** Farger for plassholderen */
  tint: [string, string];
}

export const SLIDES: Slide[] = [
  { title: "Montering av DC-lader", place: "Lillestrøm", tint: ["#0067a6", "#3aa0e0"] },
  { title: "Tavle og styringsskap", place: "Oslo", tint: ["#13233a", "#41597e"] },
  { title: "Solceller på lagertak", place: "Skedsmo", tint: ["#ff9d00", "#ffd05a"] },
  { title: "Batterirom med laststyring", place: "Gardermoen", tint: ["#11875b", "#4fd398"] },
  { title: "Ferdig ladeplass", place: "Alnabru", tint: ["#2f62d8", "#8fb4ec"] },
  { title: "Service og oppfølging", place: "Romerike", tint: ["#a14a09", "#ff8a3d"] },
];

export default function Carousel({ slides = SLIDES }: { slides?: Slide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const paused = useRef(false);

  // Hvert kort får en CSS-variabel --d: avstand fra midten (−1 … 1).
  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const center = c.offsetLeft + c.offsetWidth / 2;
      const d = (center - mid) / c.offsetWidth;
      c.style.setProperty("--d", Math.max(-1.5, Math.min(1.5, d)).toFixed(3));
      if (Math.abs(d) < bestD) {
        bestD = Math.abs(d);
        best = i;
      }
    });
    setActive(best);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          update();
        });
    };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [update]);

  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const n = el.children.length;
    const idx = ((i % n) + n) % n;
    const c = el.children[idx] as HTMLElement;
    el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: "smooth" });
  }, []);

  // Går videre av seg selv, men stopper når noen holder musen over eller bruker den.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (!paused.current && document.visibilityState === "visible") goTo(active + 1);
    }, 4500);
    return () => clearInterval(id);
  }, [active, goTo]);

  // Dra med musen på desktop (sveip fungerer av seg selv på touch).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let down = false;
    let startX = 0;
    let startLeft = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      down = true;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      el.classList.add("is-dragging");
    };
    const onMove = (e: PointerEvent) => {
      if (down) el.scrollLeft = startLeft - (e.clientX - startX);
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      el.classList.remove("is-dragging");
      update();
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [update]);

  return (
    <div
      className="carousel"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
    >
      <div
        className="carousel-track"
        ref={track}
        tabIndex={0}
        role="region"
        aria-roledescription="karusell"
        aria-label="Bilder fra anlegg"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            goTo(active + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            goTo(active - 1);
          }
        }}
      >
        {slides.map((s, i) => (
          <figure
            key={s.title}
            className={`slide${i === active ? " is-active" : ""}`}
            aria-roledescription="bilde"
            aria-label={`${i + 1} av ${slides.length}: ${s.title}`}
            onClick={() => i !== active && goTo(i)}
          >
            <div className="slide-media" style={{ ["--t1" as string]: s.tint[0], ["--t2" as string]: s.tint[1] }}>
              {s.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.src} alt={s.title} loading="lazy" draggable={false} />
              ) : (
                <span className="slide-placeholder">Bilde kommer</span>
              )}
            </div>
            <figcaption>
              <strong>{s.title}</strong>
              {s.place && <span>{s.place}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="carousel-nav">
        <button type="button" className="carousel-arrow" aria-label="Forrige bilde" onClick={() => goTo(active - 1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="carousel-dots">
          {slides.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className={i === active ? "is-current" : ""}
              aria-label={`Vis bilde ${i + 1}: ${s.title}`}
              aria-current={i === active}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button type="button" className="carousel-arrow" aria-label="Neste bilde" onClick={() => goTo(active + 1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
