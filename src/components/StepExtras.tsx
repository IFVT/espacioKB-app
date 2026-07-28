import { SPACES, type SpaceId } from "../data/spaces";
import { fmt } from "../lib/pricing";
import Photo from "./Photo";

interface Props {
  stepNo: number;
  spaceId: SpaceId;
  selected: string[];
  acceptEquip: boolean;
  onToggle: (id: string) => void;
  onAcceptEquip: (v: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StepExtras({
  stepNo,
  spaceId,
  selected,
  acceptEquip,
  onToggle,
  onAcceptEquip,
  onBack,
  onNext,
}: Props) {
  const s = SPACES[spaceId];
  const hasExtras = s.extras.length > 0;
  const anySelected = selected.length > 0;
  const blocked = anySelected && !acceptEquip;

  return (
    <section className="mb-4 rounded-kb border border-line bg-card p-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-2.5 cursor-pointer border-none bg-transparent p-0 text-[0.85rem] text-muted"
      >
        ← Cambiar día y hora
      </button>
      <h3 className="mt-0 mb-4 text-lg font-semibold">{stepNo} · Equipos (opcional)</h3>

      {!hasExtras ? (
        <div className="rounded-xl bg-card2 p-3.5 text-[0.82rem] text-muted">
          La tarifa base incluye conectar tu celular al sistema de audio. Esta
          experiencia no tiene equipos adicionales.
        </div>
      ) : (
        <>
          <div className="mb-1 rounded-xl bg-card2 p-3.5 text-[0.82rem] text-muted">
            La tarifa base ya incluye conectar tu celular al sistema de audio.
          </div>
          {s.extras.map((ex) => {
            const on = selected.includes(ex.id);
            return (
              <label
                key={ex.id}
                className={`mt-2 flex cursor-pointer items-center justify-between gap-2.5 rounded-xl border bg-card2 p-3.5 ${
                  on ? "border-accent2" : "border-line hover:border-accent2"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(ex.id)}
                  className="h-[18px] w-[18px] accent-black"
                />
                <Photo src={ex.image} alt={ex.name} className="h-14 w-14 shrink-0 rounded-lg" />
                <span className="flex-1 text-sm">
                  {ex.name}
                  <span className="block text-[0.72rem] text-muted">
                    {ex.perHour ? "por hora" : "precio único"}
                  </span>
                </span>
                <span className="whitespace-nowrap font-semibold text-txt">
                  {fmt(ex.price)}
                  {ex.perHour ? " /h" : ""}
                </span>
              </label>
            );
          })}

          {anySelected && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-card2 p-3.5 text-[0.82rem] text-muted">
              <input
                type="checkbox"
                checked={acceptEquip}
                onChange={(e) => onAcceptEquip(e.target.checked)}
                className="mt-0.5 h-[18px] w-[18px] accent-black"
              />
              <span>
                Acepto que respondo por cualquier daño a los equipos alquilados
                durante la reserva.
              </span>
            </label>
          )}
        </>
      )}

      <button
        type="button"
        disabled={blocked}
        onClick={onNext}
        className="mt-4 block w-full rounded-xl bg-black p-3.5 text-base font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
      >
        Continuar
      </button>
    </section>
  );
}
