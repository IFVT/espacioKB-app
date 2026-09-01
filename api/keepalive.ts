import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "./_lib/supabase.js";

// Ping diario (Vercel Cron) que mantiene despierto al proyecto Supabase Free
// (se pausa a los ~7 días de inactividad). Escribe una fila en keepalive_log:
// eso cuenta como actividad (una escritura pesa más que una lectura) y deja un
// rastro verificable para confirmar que el cron corre día a día.
// Es de lectura/escritura mínima e inofensivo si lo llama alguien más.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabase();
    res.setHeader("Cache-Control", "no-store");

    // 1) Registrar el ping (escritura = actividad fuerte).
    const ins = await supabase.from("keepalive_log").insert({});

    // Si la tabla aún no existe, degradamos a una lectura para que igual cuente
    // como actividad, y avisamos que no se registró.
    if (ins.error) {
      await supabase.from("reservations").select("id").limit(1);
      return res.status(200).json({ ok: true, at: new Date().toISOString(), logged: false });
    }

    // 2) Limpiar historial viejo (>35 días) para no crecer sin límite.
    const cutoff = new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString();
    await supabase.from("keepalive_log").delete().lt("pinged_at", cutoff);

    // 3) Devolver los últimos pings para poder verificar la cadencia diaria.
    const { data: recent } = await supabase
      .from("keepalive_log")
      .select("pinged_at")
      .order("pinged_at", { ascending: false })
      .limit(7);

    return res.status(200).json({ ok: true, at: new Date().toISOString(), logged: true, recent });
  } catch (err) {
    console.error("keepalive:", err);
    return res.status(500).json({ ok: false });
  }
}
