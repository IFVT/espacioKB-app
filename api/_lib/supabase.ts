import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con SERVICE KEY: salta RLS y solo puede vivir en el servidor.
 * Nunca importar este módulo desde `src/` (terminaría en el bundle del navegador).
 */
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Faltan las variables SUPABASE_URL / SUPABASE_SERVICE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
