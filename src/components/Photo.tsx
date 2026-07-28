import { useEffect, useRef, useState } from "react";

interface Props {
  src?: string;
  alt: string;
  className?: string;
}

/**
 * Muestra la foto; si el archivo aún no existe cae a un placeholder limpio.
 * Detecta el fallo de tres formas: sin src, error de carga (404 en producción),
 * o imagen que "carga" pero no decodifica (en dev Vite devuelve index.html para
 * rutas inexistentes, por eso el timeout de respaldo).
 */
export default function Photo({ src, alt, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setFailed(false);
    if (!src) {
      setFailed(true);
      return;
    }
    const t = setTimeout(() => {
      const img = ref.current;
      if (img && img.naturalWidth === 0) setFailed(true);
    }, 2000);
    return () => clearTimeout(t);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`grid place-items-center bg-card2 text-muted ${className}`}
        aria-label={alt}
      >
        <span className="text-[0.65rem] uppercase tracking-wide">Foto próximamente</span>
      </div>
    );
  }

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading="lazy"
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth === 0) setFailed(true);
      }}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
