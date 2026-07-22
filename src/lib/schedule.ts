import { SCHEDULE } from "../data/spaces";

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface BookingWindow {
  min: Date; // primer día agendable (00:00)
  max: Date; // último día agendable (23:59)
}

/**
 * Ventana agendable según SCHEDULE: desde ahora + anticipación mínima hasta
 * ahora + anticipación máxima. Usa fecha local del navegador; la validación
 * definitiva en zona horaria America/Bogota se hace en el backend.
 */
export function getBookingWindow(): BookingWindow {
  const now = new Date();
  const min = new Date(now.getTime() + SCHEDULE.minLeadHours * 3600 * 1000);
  min.setHours(0, 0, 0, 0);
  const max = new Date(now);
  max.setDate(now.getDate() + SCHEDULE.maxAdvanceDays);
  max.setHours(23, 59, 59, 999);
  return { min, max };
}

/** ¿El día es reservable? (día de la semana permitido y dentro de la ventana). */
export function isSelectableDay(d: Date, win: BookingWindow = getBookingWindow()): boolean {
  if (d < win.min || d > win.max) return false;
  return (SCHEDULE.days as readonly number[]).includes(d.getDay());
}
