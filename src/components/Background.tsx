import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// Manchas amarillas que morphean (CSS), se desplazan solas con un rango grande
// (GSAP, visible) y además siguen el mouse y el scroll. Capa de fondo fija.
const BLOBS = [
  { size: 520, top: "-8%", left: "-6%", opacity: 0.6, depth: 1.6 },
  { size: 420, top: "12%", left: "68%", opacity: 0.5, depth: 1.1 },
  { size: 360, top: "58%", left: "2%", opacity: 0.5, depth: 0.8 },
  { size: 460, top: "70%", left: "62%", opacity: 0.45, depth: 1.3 },
  { size: 320, top: "34%", left: "40%", opacity: 0.4, depth: 0.5 },
];

export default function Background() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Desplazamiento propio, con rango grande para que se note.
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".kb-blob").forEach((blob, i) => {
        gsap.to(blob, {
          x: "random(-180, 180)",
          y: "random(-140, 140)",
          scale: "random(0.8, 1.25)",
          duration: "random(9, 14)",
          delay: i * 0.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    }, el);

    // Parallax con mouse + scroll (sobre el wrapper, no choca con lo de arriba).
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
        w.x(mx * w.depth * 70);
        w.y(my * w.depth * 70 + sy * w.depth * 0.18);
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
      ctx.revert();
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
              filter: "blur(45px)",
              animationDelay: `${i * -2.5}s`,
              animationDuration: `${10 + i * 1.5}s`,
              willChange: "border-radius, transform",
            }}
          />
        </div>
      ))}
    </div>
  );
}
