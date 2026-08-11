import { useEffect, useRef, type ButtonHTMLAttributes } from "react";
import { gsap } from "gsap";

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  strengthX?: number;
  strengthY?: number;
  maxX?: number;
  maxY?: number;
}

// Botón/tarjeta con efecto magnético: se inclina suavemente hacia el cursor y
// vuelve a su sitio al salir. Intensidad configurable (suave para tarjetas).
export default function MagneticButton({
  children,
  strengthX = 0.07,
  strengthY = 0.18,
  maxX = 3.5,
  maxY = 3,
  ...props
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const xTo = useRef<((v: number) => void) | null>(null);
  const yTo = useRef<((v: number) => void) | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    xTo.current = gsap.quickTo(el, "x", { duration: 0.2, ease: "power2.out" });
    yTo.current = gsap.quickTo(el, "y", { duration: 0.2, ease: "power2.out" });
    return () => {
      gsap.killTweensOf(el);
    };
  }, []);

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const relX = e.clientX - (r.left + r.width / 2);
    const relY = e.clientY - (r.top + r.height / 2);
    xTo.current?.(clamp(relX * strengthX, maxX));
    yTo.current?.(clamp(relY * strengthY, maxY));
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
