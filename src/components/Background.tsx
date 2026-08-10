import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// Manchas amarillas difuminadas que morphean solas (CSS) y se desplazan con el
// mouse y el scroll (GSAP, parallax por profundidad). Capa de fondo fija.
const BLOBS = [
  { size: 560, top: "-12%", left: "-10%", opacity: 0.55, depth: 1.6 },
  { size: 440, top: "16%", left: "70%", opacity: 0.45, depth: 1.1 },
  { size: 360, top: "60%", left: "4%", opacity: 0.4, depth: 0.8 },
  { size: 500, top: "76%", left: "64%", opacity: 0.38, depth: 1.3 },
  { size: 320, top: "38%", left: "42%", opacity: 0.3, depth: 0.5 },
];

export default function Background() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (!el || reduce) return;

    const wraps = gsap.utils.toArray<HTMLElement>(".kb-blob-wrap").map((w) => ({
      x: gsap.quickTo(w, "x", { duration: 0.8, ease: "power2.out" }),
      y: gsap.quickTo(w, "y", { duration: 0.8, ease: "power2.out" }),
      depth: parseFloat(w.dataset.depth || "1"),
    }));

    let mx = 0;
    let my = 0;
    const apply = () => {
      const sy = window.scrollY;
      wraps.forEach((w) => {
        w.x(mx * w.depth * 60);
        w.y(my * w.depth * 60 + sy * w.depth * 0.15);
      });
    };
    const onMove = (e: MouseEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      apply();
    };
    const onScroll = () => apply();

    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className="kb-blob-wrap absolute"
          data-depth={b.depth}
          style={{ top: b.top, left: b.left, willChange: "transform" }}
        >
          <div
            className="kb-blob"
            style={{
              width: b.size,
              height: b.size,
              opacity: b.opacity,
              backgroundColor: "var(--color-accent)",
              filter: "blur(60px)",
              animationDelay: `${i * -3.5}s`,
              animationDuration: `${16 + i * 2}s`,
              willChange: "border-radius, transform",
            }}
          />
        </div>
      ))}
    </div>
  );
}
