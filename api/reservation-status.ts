import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "./_lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/reservation-status?id=<uuid>
 * Devuelve SOLO el estado de la reserva (sin datos personales). Lo usa la página
 * de retorno para saber si el webhook ya confirmó el pago. El id es un uuid
 * imposible de adivinar, así que no expone información sensible.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const id = String(req.query.id ?? "");
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ error: "id inválido" });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("reservations")
      .select("status")
      .eq("id", id)
      .single();

    if (error || !data) return res.status(404).json({ error: "No encontrada" });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ status: data.status });
  } catch (err) {
    console.error("reservation-status:", err);
    return res.status(500).json({ error: "Error" });
  }
}
