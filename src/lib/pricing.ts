import { SPACES, type SpaceId } from "../data/spaces";

export interface PriceLine {
  label: string;
  amount: number;
}

export interface PriceBreakdown {
  lines: PriceLine[];
  total: number;
}

// total = lo que se cobra EN LÍNEA (sala + equipos). El consumo mínimo NO va aquí.
// El backend DEBE recalcular esto y no confiar en el total del navegador.
export function calcTotal(
  spaceId: SpaceId,
  hours: number,
  selectedExtraIds: string[] = [],
): PriceBreakdown {
  const s = SPACES[spaceId];
  const lines: PriceLine[] = [{ label: `${s.name} · ${hours}h`, amount: s.hourly[hours] }];

  for (const ex of s.extras) {
    if (selectedExtraIds.includes(ex.id)) {
      const amount = ex.perHour ? ex.price * hours : ex.price;
      lines.push({
        label: ex.perHour ? `${ex.name} (${hours}h)` : ex.name,
        amount,
      });
    }
  }

  const total = lines.reduce((a, l) => a + l.amount, 0);
  return { lines, total };
}

export const fmt = (n: number): string => "$" + n.toLocaleString("es-CO");
