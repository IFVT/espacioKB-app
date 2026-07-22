import { SPACES, POLICIES, type SpaceId } from "../data/spaces";
import { fmt } from "../lib/pricing";

interface Props {
  stepNo: number;
  selected: SpaceId | null;
  onSelect: (id: SpaceId) => void;
  onNext: () => void;
}

export default function StepExperience({ stepNo, selected, onSelect, onNext }: Props) {
  return (
    <section className="mb-4 rounded-kb border border-line bg-card p-5">
      <h3 className="mt-0 mb-4 text-lg font-semibold">{stepNo} · ¿Qué experiencia quieres?</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.values(SPACES)).map((s) => {
          const isSel = selected === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={`cursor-pointer rounded-kb border-2 bg-card p-4 text-left transition ${
                isSel ? "border-accent bg-card2" : "border-line hover:border-accent2"
              }`}
            >
              <h4 className="m-0 text-base font-semibold">{s.name}</h4>
              <div className="text-[0.82rem] text-muted">{s.tagline}</div>
              <div className="mt-2 text-sm font-semibold text-accent">
                Desde {fmt(s.hourly[2])} / 2h
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-3 rounded-xl bg-card2 p-3.5 text-[0.82rem] text-muted">
          <p className="mb-1 font-semibold text-txt">
            Capacidad: hasta {SPACES[selected].capacity} personas
          </p>
          <ul className="m-0 list-disc space-y-0.5 pl-4">
            {POLICIES.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        disabled={!selected}
        onClick={onNext}
        className="mt-3 block w-full rounded-xl bg-accent p-3.5 text-base font-semibold text-[#1a1a1a] disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
      >
        Continuar
      </button>
    </section>
  );
}
