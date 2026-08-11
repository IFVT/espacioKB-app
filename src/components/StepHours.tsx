import { SPACES, HOURS_OPTIONS, POLICIES, type SpaceId } from "../data/spaces";
import { fmt } from "../lib/pricing";
import Photo from "./Photo";
import MagneticButton from "./MagneticButton";

interface Props {
  stepNo: number;
  spaceId: SpaceId;
  hours: number;
  onChange: (hours: number) => void;
  onNext: () => void;
}

// Precio por hora de la sala (= "conecta tu celular" en la página oficial).
const CASITA_HORA = 110000;

export default function StepHours({ stepNo, spaceId, hours, onChange, onNext }: Props) {
  const s = SPACES[spaceId];
  const hasHourImages = !!s.hourImages;

  // La Casita: banners de la sala + equipos, como la página oficial.
  const casitaItems = [
    {
      name: "Conecta tu celular al sistema de audio",
      price: `${fmt(CASITA_HORA)} / hora`,
      image: "/img/casita-celular.jpg",
    },
    ...s.extras.map((ex) => ({ name: ex.name, price: fmt(ex.price), image: ex.image })),
  ];

  return (
    <section className="mb-4 rounded-kb border border-black bg-card p-5">
      <h3 className="mt-0 mb-1 text-lg font-semibold">{stepNo} · Elige la duración</h3>
      <p className="mb-4 text-[0.82rem] text-muted">{s.name} · tarifa por horas</p>

      {s.extras.length > 0 && (
        <>
          <div className="mb-2 space-y-2.5">
            {casitaItems.map((it, i) => (
              <div key={i} className="relative h-28 overflow-hidden rounded-xl bg-black">
                <Photo src={it.image} alt={it.name} className="absolute inset-0 h-full w-full" />
                <div className="relative flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
                  <span className="box-decoration-clone bg-black px-2 py-0.5 text-[0.95rem] font-bold leading-relaxed text-white">
                    {it.name}
                  </span>
                  <span className="box-decoration-clone bg-black px-2 py-0.5 text-sm font-bold text-white">
                    {it.price}
                  </span>
                </div>
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
            <MagneticButton
              key={h}
              type="button"
              onClick={() => onChange(h)}
              strengthX={0.06}
              strengthY={0.08}
              maxX={4}
              maxY={4}
              className={`group cursor-pointer overflow-hidden rounded-xl border-2 text-left transition-[box-shadow,border-color] hover:shadow-lg ${
                isSel ? "border-accent" : "border-black hover:border-accent"
              }`}
            >
              {hasHourImages && (
                <Photo
                  src={s.hourImages?.[h]}
                  alt={`${s.name} ${h} horas`}
                  className="h-28 w-full transition-transform duration-500 group-hover:scale-110"
                />
              )}
              <div className="p-2.5">
                <div className="text-sm font-semibold">{h} horas</div>
                <div className="mt-0.5 text-[0.95rem] font-bold">{fmt(s.hourly[h])}</div>
              </div>
            </MagneticButton>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl bg-card2 p-3.5 text-[0.82rem] text-muted">
        Tarifa del espacio por {hours} horas. El consumo mínimo se paga aparte en el lugar.
      </div>

      <div className="mt-2 rounded-xl bg-card2 p-3.5 text-[0.82rem] text-muted">
        <p className="mb-1 font-semibold text-txt">
          Capacidad: hasta {s.capacity} personas
        </p>
        <ul className="m-0 list-disc space-y-0.5 pl-4">
          {POLICIES.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </div>

      <MagneticButton
        type="button"
        onClick={onNext}
        className="mt-3 block w-full rounded-xl bg-black p-3.5 text-base font-semibold text-white transition hover:bg-neutral-800"
      >
        Continuar
      </MagneticButton>
    </section>
  );
}
