import { useEffect, useState } from "react";
import type { SpaceId } from "../data/spaces";
import { getAvailability } from "../lib/api";
import Calendar from "./Calendar";

interface Props {
  stepNo: number;
  spaceId: SpaceId;
  hours: number;
  date: string | null;
  startTime: string | null;
  onPickDate: (date: string) => void;
  onPickTime: (time: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StepSchedule({
  stepNo,
  spaceId,
  hours,
  date,
  startTime,
  onPickDate,
  onPickTime,
  onBack,
  onNext,
}: Props) {
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAvailability(spaceId, date, hours)
      .then((res) => {
        if (!cancelled) setSlots(res.slots);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId, date, hours]);

  return (
    <section className="mb-4 rounded-kb border border-line bg-card p-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-2.5 cursor-pointer border-none bg-transparent p-0 text-[0.85rem] text-muted"
      >
        ← Cambiar horas
      </button>
      <h3 className="mt-0 mb-4 text-lg font-semibold">{stepNo} · Elige día y hora</h3>

      <Calendar selected={date} onSelect={onPickDate} />

      {date && (
        <div className="mt-4">
          <p className="mb-2 text-[0.82rem] text-muted">
            Hora de inicio ({hours}h de duración)
          </p>
          {loading ? (
            <div className="rounded-xl bg-card2 p-3.5 text-[0.82rem] text-muted">
              Cargando disponibilidad…
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-xl bg-card2 p-3.5 text-[0.82rem] text-muted">
              No hay horarios libres para esta duración en el día elegido.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onPickTime(t)}
                  className={`cursor-pointer rounded-xl border px-3 py-2 text-sm transition ${
                    startTime === t
                      ? "border-accent bg-card2 text-txt"
                      : "border-line bg-card2 text-muted hover:border-accent2"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={!date || !startTime}
        onClick={onNext}
        className="mt-4 block w-full rounded-xl bg-black p-3.5 text-base font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
      >
        Continuar
      </button>
    </section>
  );
}
