import { useEffect, useRef, type ButtonHTMLAttributes } from "react";
import { gsap } from "gsap";

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

// Botón con efecto magnético: se "inclina" suavemente hacia el cursor y vuelve
// a su sitio al salir. Respeta prefers-reduced-motion.
export default function MagneticButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const ref = useRef<HTMLButtonElement>(null);
  const xTo = useRef<((v: number) => void) | null>(null);
  const yTo = useRef<((v: number) => void) | null>(null);
  const enabled = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    enabled.current = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!enabled.current) return;
    xTo.current = gsap.quickTo(el, "x", { duration: 0.18, ease: "power2.out" });
    yTo.current = gsap.quickTo(el, "y", { duration: 0.18, ease: "power2.out" });
    return () => {
      gsap.killTweensOf(el);
    };
  }, []);

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!enabled.current) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const relX = e.clientX - (r.left + r.width / 2);
    const relY = e.clientY - (r.top + r.height / 2);
    xTo.current?.(clamp(relX * 0.12, 6));
    yTo.current?.(clamp(relY * 0.3, 5));
  };

  const onLeave = () => {
    xTo.current?.(0);
    yTo.current?.(0);
  };

  return (
    <button ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} {...props}>
      {children}
    </button>
  );
}
