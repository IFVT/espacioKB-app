import { SPACES, MIN_CONSUMO, type SpaceId } from "../data/spaces";
import { calcTotal, fmt } from "../lib/pricing";
import { formatTime } from "../lib/time";
import MagneticButton from "./MagneticButton";

interface Props {
  stepNo: number;
  spaceId: SpaceId;
  hours: number;
  date: string | null;
  startTime: string | null;
  extras: string[];
  paying: boolean;
  error?: string | null;
  onBack: () => void;
  onPay: () => void;
}

export default function StepSummary({
  stepNo,
  spaceId,
  hours,
  date,
  startTime,
  extras,
  paying,
  error,
  onBack,
  onPay,
}: Props) {
  const { lines, total } = calcTotal(spaceId, hours, extras);
  const minC = MIN_CONSUMO(hours);
  const s = SPACES[spaceId];

  return (
    <section className="mb-4 rounded-kb border border-black bg-card p-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-2.5 cursor-pointer border-none bg-transparent p-0 text-[0.85rem] text-muted"
      >
        ← Volver
      </button>
      <h3 className="mt-0 mb-4 text-lg font-semibold">{stepNo} · Resumen y pago</h3>

      <div className="mb-2 rounded-xl bg-card2 p-3.5 text-[0.85rem] text-muted">
        {s.name} · {date} · {startTime ? formatTime(startTime) : ""} · {hours}h
      </div>

      <div>
        {lines.map((l, i) => (
          <div key={i} className="flex justify-between py-1.5 text-[0.92rem]">
            <span className="text-muted">{l.label}</span>
            <span>{fmt(l.amount)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-black pt-3 text-[1.15rem] font-bold">
          <span>Total a pagar en línea</span>
          <span>{fmt(total)}</span>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-card2 p-3.5 text-[0.82rem] text-muted">
        Recuerda: además del pago en línea, hay un consumo mínimo de {fmt(minC)} que
        se abona en el lugar (comida/bebida).
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-[#e30613] bg-card2 p-3.5 text-[0.85rem] text-txt">
          {error}
        </div>
      )}

      <MagneticButton
        type="button"
        disabled={paying}
        onClick={onPay}
        className="mt-4 block w-full rounded-xl bg-black p-3.5 text-base font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
      >
        {paying ? "Redirigiendo al pago…" : `Pagar ${fmt(total)}`}
      </MagneticButton>

      <p className="mt-3 text-center text-[0.8rem] text-muted">
        Pago seguro con Mercado Pago. En el siguiente paso eliges{" "}
        <strong className="text-txt">PSE</strong> (débito bancario) o{" "}
        <strong className="text-txt">tarjeta</strong>.
      </p>
      <p className="mt-2 text-center text-[0.78rem] text-muted">
        Tu cupo queda apartado 30 minutos mientras completas el pago.
      </p>
    </section>
  );
}
