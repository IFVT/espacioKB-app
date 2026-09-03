import { SCHEDULE, type SpaceId } from "../data/spaces";
import type { Customer } from "./types";

// ---------------------------------------------------------------------------
// Cliente del backend (funciones serverless en /api).
//
// `vite dev` no ejecuta /api, así que EN DESARROLLO se cae a un mock local para
// poder recorrer el flujo sin servidor. En producción, por defecto, no hay mock:
// si el backend falla, el error se propaga (no queremos ocultar caídas reales).
//
// Excepción: si se despliega con VITE_DEMO=true (p.ej. un enlace de muestra sin
// credenciales), el mock también actúa en producción para que la página nunca
// se rompa. Para el despliegue real, NO definir esa variable.
// ---------------------------------------------------------------------------

const allowMock = import.meta.env.DEV || import.meta.env.VITE_DEMO === "true";

export interface StartOption {
  time: string; // "HH:00" (24:00 = medianoche)
  status: "free" | "taken" | "unavailable"; // libre / ocupada / no disponible para la selección
}

export interface AvailabilityResponse {
  date: string;
  slots: StartOption[]; // todas las horas de inicio, con su estado (libre/ocupada)
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Error ${res.status}`;
  } catch {
    return `Error ${res.status}`;
  }
}

/** Estado de una reserva (para la página de retorno tras pagar). */
export async function getReservationStatus(id: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/reservation-status?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { status?: string };
    return body.status ?? null;
  } catch {
    return null;
  }
}

export async function getAvailability(
  space: SpaceId,
  date: string,
  hours: number,
): Promise<AvailabilityResponse> {
  const qs = new URLSearchParams({ space, date, hours: String(hours) });
  try {
    const res = await fetch(`/api/availability?${qs}`);
    if (!res.ok) throw new Error(await readError(res));
    return (await res.json()) as AvailabilityResponse;
  } catch (err) {
    if (!allowMock) throw err;
    console.warn("[dev] /api/availability no disponible, usando mock local:", err);
    return mockAvailability(date, hours);
  }
}

export interface CreatePaymentPayload {
  space: SpaceId;
  date: string;
  start_time: string;
  hours: number;
  extras: string[];
  customer: Customer;
}

export interface CreatePaymentResponse {
  reservationId: string;
  checkoutUrl: string;
  /** true = respuesta simulada en dev; no redirigir a la pasarela. */
  mock?: boolean;
}

export async function createPayment(
  payload: CreatePaymentPayload,
): Promise<CreatePaymentResponse> {
  try {
    const res = await fetch("/api/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readError(res));
    return (await res.json()) as CreatePaymentResponse;
  } catch (err) {
    if (!allowMock) throw err;
    console.warn("[dev] /api/create-payment no disponible, usando mock local:", err);
    await new Promise((r) => setTimeout(r, 400));
    return { reservationId: "mock-" + Date.now(), checkoutUrl: "#", mock: true };
  }
}

// --- Mock solo para desarrollo -------------------------------------------
// Muestra todas las horas que caben antes del cierre; no descuenta reservas.
function mockAvailability(date: string, hours: number): AvailabilityResponse {
  const slots: StartOption[] = [];
  for (let h = SCHEDULE.openHour; h <= 26; h++) {
    slots.push({
      time: `${String(h).padStart(2, "0")}:00`,
      status: h + hours > SCHEDULE.closeHour ? "unavailable" : "free",
    });
  }
  return { date, slots };
}
