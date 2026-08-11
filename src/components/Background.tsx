import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// Fondo de "ondas de sonido": capas de ondas (bandas con degradado + líneas
// nítidas) que fluyen continuamente y responden al mouse y al scroll. Todo se
// dibuja recalculando el path de cada onda cada frame con gsap.ticker.

const VW = 1440;
const VH = 900;
const TWO_PI = Math.PI * 2;

type Comp = { f: number; a: number; s: number; p: number };
interface Wave {
  baseY: number;
  comps: Comp[];
  close: "top" | "bottom" | null;
  fill: string | null;
  stroke: string | null;
  width: number;
  opacity: number;
  parallax: number;
  pointerAmp: number;
}

const WAVES: Wave[] = [
  // Banda superior (degradado suave que cae desde arriba)
  { baseY: 240, comps: [{ f: 1.4, a: 34, s: 0.35, p: 0.4 }, { f: 3.0, a: 12, s: 0.6, p: 1.8 }], close: "top", fill: "url(#kbFadeUp)", stroke: null, width: 0, opacity: 1, parallax: 0.05, pointerAmp: 55 },
  // Línea amarilla marcada cerca del título
  { baseY: 180, comps: [{ f: 1.7, a: 30, s: 0.5, p: 0.2 }, { f: 3.4, a: 10, s: -0.7, p: 1.1 }], close: null, fill: null, stroke: "#fae100", width: 2.5, opacity: 0.75, parallax: 0.06, pointerAmp: 65 },
  // Línea fina secundaria
  { baseY: 300, comps: [{ f: 2.1, a: 24, s: -0.45, p: 2.2 }, { f: 4.2, a: 9, s: 0.8, p: 0.6 }], close: null, fill: null, stroke: "#fae100", width: 1.5, opacity: 0.32, parallax: 0.07, pointerAmp: 70 },
  // Banda inferior (degradado que sube desde abajo)
  { baseY: 650, comps: [{ f: 1.2, a: 46, s: 0.3, p: 0 }, { f: 2.7, a: 16, s: 0.6, p: 1.4 }], close: "bottom", fill: "url(#kbFadeDown)", stroke: null, width: 0, opacity: 1, parallax: 0.1, pointerAmp: 80 },
  // Línea nítida sobre la banda inferior
  { baseY: 630, comps: [{ f: 1.3, a: 42, s: 0.32, p: 0.3 }, { f: 2.9, a: 14, s: -0.55, p: 1.9 }], close: null, fill: null, stroke: "#fae100", width: 2, opacity: 0.6, parallax: 0.11, pointerAmp: 85 },
  // Línea negra muy tenue (contraste editorial)
  { baseY: 780, comps: [{ f: 1.9, a: 30, s: 0.42, p: 2.5 }], close: null, fill: null, stroke: "#111111", width: 1.5, opacity: 0.08, parallax: 0.13, pointerAmp: 70 },
];

function wavePath(w: Wave, t: number, px: number, py: number, sy: number): string {
  const steps = 40;
  const off = w.parallax * sy + (py - 0.5) * w.pointerAmp;
  const phase = px * 1.6;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * VW;
    let y = w.baseY + off;
    for (const c of w.comps) y += c.a * Math.sin((x / VW) * c.f * TWO_PI + t * c.s + c.p + phase);
    pts.push([x, y]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    d += ` Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
  }
  if (w.close === "bottom") d += ` L ${VW} ${VH} L 0 ${VH} Z`;
  else if (w.close === "top") d += ` L ${VW} 0 L 0 0 Z`;
  return d;
}

export default function Background() {
  const pathsRef = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    let tpx = 0.5;
    let tpy = 0.5;
    let tsy = 0;
    const st = { px: 0.5, py: 0.5, sy: 0 };

    const onMove = (e: MouseEvent) => {
      tpx = e.clientX / window.innerWidth;
      tpy = e.clientY / window.innerHeight;
    };
    const onScroll = () => {
      tsy = window.scrollY;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onScroll, { passive: true });

    const tick = () => {
      // Suavizado (lerp) hacia los objetivos de mouse/scroll.
      st.px += (tpx - st.px) * 0.06;
      st.py += (tpy - st.py) * 0.06;
      st.sy += (tsy - st.sy) * 0.1;
      const t = gsap.ticker.time;
      for (let i = 0; i < WAVES.length; i++) {
        const el = pathsRef.current[i];
        if (el) el.setAttribute("d", wavePath(WAVES[i], t, st.px, st.py, st.sy));
      }
    };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="kbFadeUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fae100" stopOpacity="0" />
            <stop offset="100%" stopColor="#fae100" stopOpacity="0.26" />
          </linearGradient>
          <linearGradient id="kbFadeDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fae100" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#fae100" stopOpacity="0" />
          </linearGradient>
        </defs>
        {WAVES.map((w, i) => (
          <path
            key={i}
            ref={(el) => {
              pathsRef.current[i] = el;
            }}
            fill={w.fill ?? "none"}
            stroke={w.stroke ?? "none"}
            strokeWidth={w.width}
            strokeOpacity={w.opacity}
            style={{ vectorEffect: "non-scaling-stroke" }}
          />
        ))}
      </svg>
    </div>
  );
}
