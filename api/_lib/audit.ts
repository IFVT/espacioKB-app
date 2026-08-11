import type { SupabaseClient } from "@supabase/supabase-js";

interface EventInput {
  reservationId?: string | null;
  paymentId?: string | number | null;
  event: string;
  status?: string | null;
  amount?: number | null;
  detail?: Record<string, unknown>;
}

/**
 * Registra un evento en payment_events. Es "a prueba de balas": si la tabla no
 * existe o la inserción falla, NUNCA rompe el flujo de pago (solo loguea).
 */
export async function logPaymentEvent(
  supabase: SupabaseClient,
  ev: EventInput,
): Promise<void> {
  try {
    const { error } = await supabase.from("payment_events").insert({
      reservation_id: ev.reservationId ?? null,
      payment_id: ev.paymentId != null ? String(ev.paymentId) : null,
      event: ev.event,
      status: ev.status ?? null,
      amount: ev.amount ?? null,
      detail: ev.detail ?? {},
    });
    if (error) console.error("payment_events:", error.message);
  } catch (err) {
    console.error("payment_events:", err);
  }
}
