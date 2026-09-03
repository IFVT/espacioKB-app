import { SPACES, MIN_CONSUMO, type SpaceId } from "../data/spaces";
import { calcTotal, fmt } from "../lib/pricing";
import { formatRange } from "../lib/time";
import { openDaysLabel, openHoursLabel } from "../lib/schedule";

interface Props {
  spaceId: SpaceId;
  hours: number;
  date: string | null;
  startTime: string | null;
  extras: string[];
}

// Resumen lateral con total en vivo (solo se muestra en pantallas grandes).
export default function SummaryAside({ spaceId, hours, date, startTime, extras }: Props) {
  const s = SPACES[spaceId];
  const { lines, total } = calcTotal(spaceId, hours, extras);
  const minC = MIN_CONSUMO(hours);

  return (
    <div className="space-y-3">
      <div className="rounded-kb border border-black bg-card2 p-3 text-[0.8rem]">
        <div className="font-semibold text-txt">Horario de atención</div>
        <div className="text-muted">
          {openDaysLabel} · {openHoursLabel}
        </div>
      </div>

      <div className="rounded-kb border border-black bg-card p-4">
      <h4 className="mt-0 mb-3 text-base font-semibold">Tu reserva</h4>

      <div className="mb-3 rounded-lg bg-card2 p-3 text-[0.82rem]">
        <div className="font-semibold text-txt">{s.name}</div>
        <div className="text-muted">
          {hours} horas
          {date ? ` · ${date}` : ""}
        </div>
        <div className="mt-0.5 font-medium text-txt">
          {startTime ? `Hora: ${formatRange(startTime, hours)}` : "Elige la hora de inicio"}
        </div>
      </div>

      <div className="space-y-1.5">
        {lines.map((l, i) => (
          <div key={i} className="flex justify-between gap-2 text-[0.82rem]">
            <span className="text-muted">{l.label}</span>
            <span className="whitespace-nowrap">{fmt(l.amount)}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between border-t border-black pt-2 font-bold">
        <span>Total en línea</span>
        <span>{fmt(total)}</span>
      </div>

      <p className="mt-2 text-[0.72rem] text-muted">
        + consumo mínimo de {fmt(minC)} que se paga en el lugar.
      </p>
      </div>
    </div>
  );
}
