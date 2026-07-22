import { SPACES, HOURS_OPTIONS, type SpaceId } from "../data/spaces";
import { fmt } from "../lib/pricing";

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
      <h3 className="mt-0 mb-4 text-lg font-semibold">{stepNo} · ¿Cuántas horas?</h3>

      <select
        value={hours}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-line bg-card2 p-3 text-base text-txt outline-none focus:border-accent"
      >
        {HOURS_OPTIONS.map((h) => (
          <option key={h} value={h}>
            {h} horas — {fmt(s.hourly[h])}
          </option>
        ))}
      </select>

      <div className="mt-3 rounded-xl bg-card2 p-3.5 text-[0.82rem] text-muted">
        Tarifa del espacio por {hours} horas. El consumo mínimo se paga aparte en el lugar.
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-3 block w-full rounded-xl bg-accent p-3.5 text-base font-semibold text-[#1a1a1a]"
      >
        Continuar
      </button>
    </section>
  );
}
