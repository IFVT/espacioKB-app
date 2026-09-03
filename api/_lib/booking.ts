import { SPACES, SCHEDULE, type SpaceId } from "./spaces.js";
import { calcTotal } from "./pricing.js";

// ---------------------------------------------------------------------------
// Tiempo. Colombia es UTC-5 fijo (sin horario de verano), así que trabajamos
// con "hora de pared" de Bogotá representada como milisegundos UTC. Esto evita
// depender de la zona horaria del servidor (Vercel corre en UTC).
// ---------------------------------------------------------------------------

const BOGOTA_OFFSET_MS = 5 * 3600 * 1000;

/** Milisegundos de una fecha+hora local de Bogotá. */
export function wallMs(dateISO: string, hour: number, minute = 0): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return Date.UTC(y, m - 1, d, hour, minute);
}

/** "Ahora" en hora de pared de Bogotá. */
export function nowWallMs(): number {
  return Date.now() - BOGOTA_OFFSET_MS;
}

/** Día de la semana (0=dom … 6=sáb) de una fecha ISO, en hora local. */
export function weekdayOf(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const HHMM = (h: number) => `${String(h).padStart(2, "0")}:00`;

// ---------------------------------------------------------------------------
// Disponibilidad
// ---------------------------------------------------------------------------

export interface TakenRange {
  start_at: string; // timestamp sin zona, hora local de Bogotá
  end_at: string; // ya incluye el buffer
}

const parseTaken = (s: string): number => {
  // Postgres devuelve "YYYY-MM-DDTHH:MM:SS" o "YYYY-MM-DD HH:MM:SS"
  const [datePart, timePart = "00:00:00"] = s.replace("T", " ").split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm);
};

/**
 * Horas de inicio libres para una fecha y duración, aplicando SCHEDULE
 * (apertura/cierre, anticipación mínima) y las franjas ya ocupadas.
 *
 * Los rangos ocupados que llegan de la base YA incluyen el buffer; al candidato
 * también se le suma, de modo que dos reservas quedan separadas al menos
 * `bufferMinutes` a cada lado.
 */
export type SlotStatus = "free" | "taken" | "unavailable";

export interface StartOption {
  time: string; // "HH:00" (24:00 = medianoche)
  // free = seleccionable · taken = sala ocupada (rojo) ·
  // unavailable = no aplica para esta duración/anticipación (gris, deshabilitado)
  status: SlotStatus;
}

/**
 * SIEMPRE devuelve todas las horas de inicio posibles: desde la apertura (7pm)
 * hasta la medianoche (24:00, el último inicio posible para una reserva de 2h).
 * Las que no aplican para la duración elegida (terminarían después del cierre a
 * las 2am) o no respetan la anticipación mínima se marcan "unavailable" en vez
 * de esconderse, para que el horario de atención quede siempre visible. Las
 * ocupadas se marcan "taken" (cada espacio es una sola sala).
 */
export function startTimeOptions(
  dateISO: string,
  hours: number,
  taken: TakenRange[],
): StartOption[] {
  const bufferMs = SCHEDULE.bufferMinutes * 60 * 1000;
  const earliest = nowWallMs() + SCHEDULE.minLeadHours * 3600 * 1000;
  const takenMs = taken.map((t) => ({
    start: parseTaken(t.start_at),
    end: parseTaken(t.end_at),
  }));

  // Se muestra hasta las 2am (26): 1am y 2am siempre salen "unavailable" (no se
  // puede INICIAR tan tarde con el mínimo de 2h), pero dejan visible el cierre.
  const MAX_START = 26;
  const options: StartOption[] = [];

  for (let h = SCHEDULE.openHour; h <= MAX_START; h++) {
    let status: SlotStatus;
    if (h + hours > SCHEDULE.closeHour) {
      status = "unavailable"; // terminaría después del cierre (2am)
    } else {
      const start = wallMs(dateISO, h);
      if (start < earliest) {
        status = "unavailable"; // no respeta la anticipación mínima
      } else {
        const end = start + hours * 3600 * 1000 + bufferMs;
        const overlaps = takenMs.some((t) => start < t.end && t.start < end);
        status = overlaps ? "taken" : "free";
      }
    }
    options.push({ time: HHMM(h), status });
  }
  return options;
}

// ---------------------------------------------------------------------------
// Validación de entrada (nunca confiar en el navegador)
// ---------------------------------------------------------------------------

export interface BookingInput {
  space: SpaceId;
  date: string;
  start_time: string;
  hours: number;
  extras: string[];
}

export class BadRequest extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-4]):00$/; // permite 24:00 (medianoche) como inicio

/** Valida el payload y devuelve el monto RECALCULADO EN EL SERVIDOR. */
export function validateBooking(raw: unknown): BookingInput & { amount: number } {
  const b = (raw ?? {}) as Record<string, unknown>;

  const space = b.space as SpaceId;
  if (space !== "karaoke" && space !== "casita") throw new BadRequest("space inválido");

  const date = String(b.date ?? "");
  if (!DATE_RE.test(date)) throw new BadRequest("date debe ser YYYY-MM-DD");

  const start_time = String(b.start_time ?? "");
  if (!TIME_RE.test(start_time)) throw new BadRequest("start_time debe ser HH:00");

  const hours = Number(b.hours);
  if (!Number.isInteger(hours) || hours < SCHEDULE.minHours || hours > SCHEDULE.maxHours) {
    throw new BadRequest(`hours debe estar entre ${SCHEDULE.minHours} y ${SCHEDULE.maxHours}`);
  }

  if (!(SCHEDULE.days as readonly number[]).includes(weekdayOf(date))) {
    throw new BadRequest("El espacio no abre ese día");
  }

  const startHour = Number(start_time.slice(0, 2));
  if (startHour < SCHEDULE.openHour || startHour + hours > SCHEDULE.closeHour) {
    throw new BadRequest("El horario está fuera de la franja de atención");
  }

  const start = wallMs(date, startHour);
  if (start < nowWallMs() + SCHEDULE.minLeadHours * 3600 * 1000) {
    throw new BadRequest(`Se requieren al menos ${SCHEDULE.minLeadHours}h de anticipación`);
  }
  if (start > nowWallMs() + SCHEDULE.maxAdvanceDays * 24 * 3600 * 1000) {
    throw new BadRequest("La fecha excede la anticipación máxima");
  }

  // Solo se aceptan ids de equipos que realmente existen en ese espacio.
  const validIds = new Set(SPACES[space].extras.map((e) => e.id));
  const rawExtras = Array.isArray(b.extras) ? (b.extras as unknown[]) : [];
  const extras = rawExtras.map(String).filter((id) => validIds.has(id));
  if (extras.length !== rawExtras.length) throw new BadRequest("extras inválidos");

  // El precio SIEMPRE se recalcula aquí; el total del navegador se ignora.
  const { total } = calcTotal(space, hours, extras);

  return { space, date, start_time, hours, extras, amount: total };
}

export interface CustomerInput {
  name: string;
  phone: string;
  email: string;
}

export function validateCustomer(raw: unknown): CustomerInput {
  const c = (raw ?? {}) as Record<string, unknown>;
  const name = String(c.name ?? "").trim();
  const phone = String(c.phone ?? "").trim();
  const email = String(c.email ?? "").trim();

  if (name.length < 2) throw new BadRequest("Nombre inválido");
  if (phone.replace(/\D/g, "").length < 7) throw new BadRequest("Teléfono inválido");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequest("Correo inválido");

  return { name, phone, email };
}
