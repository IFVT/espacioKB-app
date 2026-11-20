import type { VercelRequest, VercelResponse } from "@vercel/node"
import { addCalendarEvent, type ConfirmedReservation } from "./_lib/notify.js"

// TEMPORAL: crea un evento de prueba en el calendario configurado
// (GOOGLE_CALENDAR_ID), para verificar la migración del calendario a `bar`.
// Protegido con token. QUITAR después de probar.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.query.token !== "kb-verify-2026") {
    return res.status(404).json({ error: "no disponible" })
  }

  const sample: ConfirmedReservation = {
    id: "test-calendar",
    space: "karaoke",
    date: "2026-12-26",
    start_time: "20:00",
    hours: 2,
    extras: [],
    amount: 0,
    customer_name: "Prueba Calendario",
    customer_phone: "3000000000",
    customer_email: null,
  }

  const out: Record<string, unknown> = {
    calendarId_set: !!process.env.GOOGLE_CALENDAR_ID,
  }
  try {
    await addCalendarEvent(sample)
    out.calendar = "ok"
  } catch (e) {
    out.calendar = String(e)
  }
  return res.status(200).json(out)
}
