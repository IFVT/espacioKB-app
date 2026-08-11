import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "./_lib/supabase.js";

// Ping diario (Vercel Cron) que hace una consulta mínima a la base para que el
// proyecto Supabase Free no se pause por inactividad (se pausa a los ~7 días).
// Es de solo lectura e inofensivo si lo llama alguien más.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("reservations").select("id").limit(1);
    if (error) throw error;
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, at: new Date().toISOString() });
  } catch (err) {
    console.error("keepalive:", err);
    return res.status(500).json({ ok: false });
  }
}
