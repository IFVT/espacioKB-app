import type { VercelRequest, VercelResponse } from "@vercel/node"
import { sendConfirmationEmails, addCalendarEvent, type ConfirmedReservation } from "./_lib/notify.js"

// TEMPORAL: dispara el correo de confirmación (y el evento de calendario) con
// datos de ejemplo, para verificar la integración sin hacer un pago real.
// Protegido con un token en la URL. QUITAR después de probar.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.query.token !== "kb-verify-2026") {
    return res.status(404).json({ error: "no disponible" })
  }

  const sample: ConfirmedReservation = {
    id: "test-0000",
    space: "karaoke",
    date: "2026-09-26",
    start_time: "20:00",
    hours: 2,
    extras: [],
    amount: 180000,
    customer_name: "Prueba Correo",
    customer_phone: "3000000000",
    customer_email: String(req.query.to ?? process.env.NOTIFY_EMAIL ?? ""),
  }

  const out: Record<string, unknown> = {}
  try {
    await sendConfirmationEmails(sample)
    out.email = "ok"
  } catch (e) {
    out.email = String(e)
  }
  try {
    await addCalendarEvent(sample)
    out.calendar = "ok"
  } catch (e) {
    out.calendar = String(e)
  }
  return res.status(200).json(out)
}
