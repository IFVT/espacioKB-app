import { SPACES, HOURS_OPTIONS, type SpaceId } from "../data/spaces";
import { fmt } from "../lib/pricing";
import Photo from "./Photo";

interface Props {
  stepNo: number;
  spaceId: SpaceId;
  hours: number;
  onChange: (hours: number) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StepHours({ stepNo, spaceId, hours, onChange, onBack, onNext }: Props) {
  const s = SPACES[spaceId];

  return (
    <section className="mb-4 rounded-kb border border-line bg-card p-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-2.5 cursor-pointer border-none bg-transparent p-0 text-[0.85rem] text-muted"
      >
        ← Cambiar experiencia
      </button>
      <h3 className="mt-0 mb-1 text-lg font-semibold">{stepNo} · Elige la duración</h3>
      <p className="mb-4 text-[0.82rem] text-muted">{s.name} · tarifa por horas</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {HOURS_OPTIONS.map((h) => {
          const isSel = hours === h;
          const img = s.hourImages?.[h] ?? s.image;
          return (
            <button
              key={h}
              type="button"
              onClick={() => onChange(h)}
              className={`cursor-pointer overflow-hidden rounded-xl border-2 text-left transition ${
                isSel ? "border-accent2" : "border-line hover:border-accent2"
              }`}
            >
              <Photo src={img} alt={`${s.name} ${h} horas`} className="h-28 w-full" />
              <div className="p-2.5">
                <div className="text-sm font-semibold">{h} horas</div>
                <div className="mt-0.5 text-[0.95rem] font-bold">{fmt(s.hourly[h])}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl bg-card2 p-3.5 text-[0.82rem] text-muted">
        Tarifa del espacio por {hours} horas. El consumo mínimo se paga aparte en el lugar.
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-3 block w-full rounded-xl bg-black p-3.5 text-base font-semibold text-white transition hover:bg-neutral-800"
      >
        Continuar
      </button>
    </section>
  );
}
