import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SCHEDULE } from "./_lib/spaces.js";
import { getSupabase } from "./_lib/supabase.js";
import { startTimeOptions, weekdayOf, type TakenRange } from "./_lib/booking.js";

/** GET /api/availability?space=karaoke&date=2026-07-16&hours=2 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const space = String(req.query.space ?? "");
  const date = String(req.query.date ?? "");
  const hours = Number(req.query.hours);

  if (space !== "karaoke" && space !== "casita") {
    return res.status(400).json({ error: "space inválido" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date debe ser YYYY-MM-DD" });
  }
  if (!Number.isInteger(hours) || hours < SCHEDULE.minHours || hours > SCHEDULE.maxHours) {
    return res.status(400).json({ error: "hours fuera de rango" });
  }

  // Día cerrado: no hace falta consultar la base.
  if (!(SCHEDULE.days as readonly number[]).includes(weekdayOf(date))) {
    return res.status(200).json({ date, slots: [] });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("taken_ranges", {
      p_space: space,
      p_date: date,
    });
    if (error) throw error;

    const slots = startTimeOptions(date, hours, (data ?? []) as TakenRange[]);
    // Disponibilidad cambia constantemente: no cachear.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ date, slots });
  } catch (err) {
    console.error("availability:", err);
    return res.status(500).json({ error: "No se pudo consultar la disponibilidad" });
  }
}
