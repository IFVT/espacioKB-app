import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// Orbes amarillos difuminados que flotan, "respiran" y siguen el mouse con
// parallax por profundidad. Capa de fondo fija, sin interacción; los recuadros
// blancos quedan siempre por encima.
const ORBS = [
  { size: 560, top: "-10%", left: "-8%", opacity: 0.5, depth: 1.6 },
  { size: 420, top: "20%", left: "72%", opacity: 0.42, depth: 1.1 },
  { size: 340, top: "62%", left: "8%", opacity: 0.38, depth: 0.8 },
  { size: 480, top: "78%", left: "68%", opacity: 0.34, depth: 1.3 },
  { size: 300, top: "42%", left: "40%", opacity: 0.28, depth: 0.5 },
];

export default function Background() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // sin movimiento si el usuario lo desactivó

    const el = ref.current;
    if (!el) return;

    // Flotación + respiración (sobre el orbe interno).
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".kb-orb").forEach((orb, i) => {
        gsap.to(orb, {
          x: "random(-70, 70)",
          y: "random(-60, 60)",
          scale: "random(0.85, 1.2)",
          duration: "random(14, 22)",
          delay: i * 0.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    }, el);

    // Parallax con el mouse (sobre el wrapper, para no chocar con la flotación).
    const wraps = gsap.utils.toArray<HTMLElement>(".kb-orb-wrap").map((w) => ({
      x: gsap.quickTo(w, "x", { duration: 1.2, ease: "power3.out" }),
      y: gsap.quickTo(w, "y", { duration: 1.2, ease: "power3.out" }),
      depth: parseFloat(w.dataset.depth || "1"),
    }));

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX / window.innerWidth - 0.5;
      const dy = e.clientY / window.innerHeight - 0.5;
      wraps.forEach((w) => {
        w.x(dx * w.depth * 70);
        w.y(dy * w.depth * 70);
      });
    };
    window.addEventListener("mousemove", onMove);

    return () => {
      window.removeEventListener("mousemove", onMove);
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {ORBS.map((o, i) => (
        <div
          key={i}
          className="kb-orb-wrap absolute"
          data-depth={o.depth}
          style={{ top: o.top, left: o.left, willChange: "transform" }}
        >
          <div
            className="kb-orb rounded-full"
            style={{
              width: o.size,
              height: o.size,
              opacity: o.opacity,
              backgroundColor: "var(--color-accent)",
              filter: "blur(70px)",
              willChange: "transform",
            }}
          />
        </div>
      ))}
    </div>
  );
}
