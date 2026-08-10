import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// Orbes amarillos difuminados, muy suaves, que flotan y "respiran" detrás del
// contenido. Van en la capa de fondo (fija, sin interacción) y los recuadros
// blancos quedan siempre por encima.
const ORBS = [
  { size: 560, top: "-10%", left: "-8%", opacity: 0.5 },
  { size: 420, top: "20%", left: "72%", opacity: 0.42 },
  { size: 340, top: "62%", left: "8%", opacity: 0.38 },
  { size: 480, top: "78%", left: "68%", opacity: 0.34 },
  { size: 300, top: "42%", left: "40%", opacity: 0.28 },
];

export default function Background() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // sin movimiento si el usuario lo desactivó

    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".kb-orb").forEach((orb, i) => {
        gsap.to(orb, {
          x: "random(-90, 90)",
          y: "random(-70, 70)",
          scale: "random(0.85, 1.2)",
          duration: "random(14, 22)",
          delay: i * 0.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    }, el);

    return () => ctx.revert();
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
          className="kb-orb absolute rounded-full"
          style={{
            width: o.size,
            height: o.size,
            top: o.top,
            left: o.left,
            opacity: o.opacity,
            backgroundColor: "var(--color-accent)",
            filter: "blur(70px)",
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}
