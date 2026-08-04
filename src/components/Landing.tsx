import { SPACES, type SpaceId } from "../data/spaces";
import { fmt } from "../lib/pricing";
import Photo from "./Photo";

interface Props {
  onPick: (id: SpaceId) => void;
}

// Pantalla de respaldo: solo se ve si abren la app sin ?espacio=... (dominio
// pelado). El flujo normal entra directo por enlace a cada espacio.
export default function Landing({ onPick }: Props) {
  return (
    <section className="mb-4 rounded-kb border border-black bg-card p-5">
      <h3 className="mt-0 mb-4 text-lg font-semibold">Elige tu espacio</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.values(SPACES).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            className="cursor-pointer overflow-hidden rounded-kb border-2 border-black text-left transition hover:border-accent"
          >
            <Photo alt={s.name} className="h-40 w-full" />
            <div className="p-4">
              <h4 className="m-0 text-base font-semibold">{s.name}</h4>
              <div className="text-[0.82rem] text-muted">{s.tagline}</div>
              <div className="mt-2 inline-block bg-accent px-2 py-0.5 text-sm font-bold text-txt">
                Desde {fmt(s.hourly[2])} / 2h
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
