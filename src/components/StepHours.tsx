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

// Precio por hora de la sala (= "conecta tu celular" en la página oficial).
const CASITA_HORA = 110000;

export default function StepHours({ stepNo, spaceId, hours, onChange, onBack, onNext }: Props) {
  const s = SPACES[spaceId];
  const hasHourImages = !!s.hourImages;

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

      {/* La Casita: lista de la sala + equipos, como la página oficial. */}
      {s.extras.length > 0 && (
        <>
          <div className="mb-2 overflow-hidden rounded-xl border border-line">
            <div className="flex items-start justify-between gap-3 border-b border-line p-3.5">
              <span className="text-sm">Conecta tu celular al sistema de audio</span>
              <span className="whitespace-nowrap text-sm font-bold">
                {fmt(CASITA_HORA)} <span className="font-normal text-muted">/ hora</span>
              </span>
            </div>
            {s.extras.map((ex, i) => (
              <div
                key={ex.id}
                className={`flex items-start justify-between gap-3 p-3.5 ${
                  i < s.extras.length - 1 ? "border-b border-line" : ""
                }`}
              >
                <span className="text-sm">{ex.name}</span>
                <span className="whitespace-nowrap text-sm font-bold">{fmt(ex.price)}</span>
              </div>
            ))}
          </div>
          <p className="mb-5 text-[0.78rem] text-muted">
            Si quieres algún equipo, es por aparte. Lo eliges en el siguiente paso.
          </p>
        </>
      )}

      <p className="mb-2 text-[0.82rem] font-semibold text-txt">Elige cuántas horas</p>
      <div className={`grid gap-3 ${hasHourImages ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3"}`}>
        {HOURS_OPTIONS.map((h) => {
          const isSel = hours === h;
          return (
            <button
              key={h}
              type="button"
              onClick={() => onChange(h)}
              className={`cursor-pointer overflow-hidden rounded-xl border-2 text-left transition ${
                isSel ? "border-accent2" : "border-line hover:border-accent2"
              }`}
            >
              {hasHourImages && (
                <Photo
                  src={s.hourImages?.[h]}
                  alt={`${s.name} ${h} horas`}
                  className="h-28 w-full"
                />
              )}
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
