import { useMemo, useState } from "react";
import { getBookingWindow, isSelectableDay, toISO } from "../lib/schedule";

interface Props {
  selected: string | null; // ISO "YYYY-MM-DD"
  onSelect: (iso: string) => void;
}

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });

const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();

export default function Calendar({ selected, onSelect }: Props) {
  const win = useMemo(() => getBookingWindow(), []);
  const [view, setView] = useState<Date>(() => new Date(win.min.getFullYear(), win.min.getMonth(), 1));

  const minKey = monthKey(win.min);
  const maxKey = monthKey(win.max);
  const viewKey = monthKey(view);

  // Celdas de la grilla: relleno inicial hasta lunes + días del mes.
  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // lunes = 0
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(view.getFullYear(), view.getMonth(), d));
    return out;
  }, [view]);

  const move = (delta: number) => {
    const next = new Date(view.getFullYear(), view.getMonth() + delta, 1);
    const k = monthKey(next);
    if (k >= minKey && k <= maxKey) setView(next);
  };

  return (
    <div className="rounded-xl border border-black bg-card2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={viewKey <= minKey}
          className="grid h-8 w-8 place-items-center rounded-lg border border-black text-muted disabled:opacity-30 enabled:hover:border-accent"
        >
          ‹
        </button>
        <span className="text-sm font-semibold capitalize">{monthFmt.format(view)}</span>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={viewKey >= maxKey}
          className="grid h-8 w-8 place-items-center rounded-lg border border-black text-muted disabled:opacity-30 enabled:hover:border-accent"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[0.7rem] text-muted">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const iso = toISO(d);
          const ok = isSelectableDay(d, win);
          const isSel = iso === selected;
          return (
            <button
              key={iso}
              type="button"
              disabled={!ok}
              onClick={() => onSelect(iso)}
              className={`grid aspect-square place-items-center rounded-lg text-sm transition ${
                isSel
                  ? "bg-accent font-semibold text-[#1a1a1a]"
                  : ok
                    ? "border border-black text-txt hover:border-accent"
                    : "cursor-not-allowed text-muted/30"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
