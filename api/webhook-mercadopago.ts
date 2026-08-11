import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "./_lib/supabase";
import { mpFetch, verifyWebhookSignature } from "./_lib/mp";
import { logPaymentEvent } from "./_lib/audit";

/**
 * POST /api/webhook-mercadopago
 *
 * Seguridad en capas:
 *  1. Verifica la firma x-signature de MP (rechaza notificaciones falsas).
 *  2. Nunca confía en el cuerpo: consulta el pago real contra la API de MP.
 *  3. Valida moneda y monto contra lo que calculamos nosotros.
 *  4. Confirma de forma idempotente (a prueba de notificaciones duplicadas).
 *
 * Responde 200 salvo error nuestro (500) para que MP reintente; 401 si la firma
 * es inválida (no es MP, no tiene sentido reintentar).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  // 1) Firma
  if (!verifyWebhookSignature(req)) {
    console.warn("webhook-mercadopago: firma inválida");
    return res.status(401).json({ error: "Firma inválida" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});

    const type = body.type ?? body.topic ?? req.query.type ?? req.query.topic;
    const paymentId = body?.data?.id ?? body?.id ?? req.query["data.id"] ?? req.query.id;

    if (type !== "payment" || !paymentId) {
      return res.status(200).json({ ignored: true }); // p.ej. merchant_order
    }

    // 2) Estado real del pago (con timeout)
    const mpRes = await mpFetch(`/v1/payments/${paymentId}`, { method: "GET" });
    if (mpRes.status === 404) {
      return res.status(200).json({ ignored: true }); // pago inexistente
    }
    if (!mpRes.ok) throw new Error(`Mercado Pago respondió ${mpRes.status}`);

    const payment = (await mpRes.json()) as {
      status: string;
      currency_id: string;
      external_reference: string | null;
      transaction_amount: number;
    };

    const reservationId = payment.external_reference;
    if (!reservationId) return res.status(200).json({ ignored: true });

    const supabase = getSupabase();

    if (payment.status === "approved") {
      const { data: current } = await supabase
        .from("reservations")
        .select("id, status, amount")
        .eq("id", reservationId)
        .single();

      if (!current) return res.status(200).json({ ignored: true });
      if (current.status === "confirmed") return res.status(200).json({ ok: true });

      // 3) Moneda + monto deben coincidir exactamente con lo calculado.
      if (payment.currency_id !== "COP") {
        console.error(`Moneda inesperada en ${reservationId}: ${payment.currency_id}`);
        await logPaymentEvent(supabase, {
          reservationId,
          paymentId,
          event: "currency_mismatch",
          status: payment.status,
          detail: { currency_id: payment.currency_id },
        });
        return res.status(200).json({ ignored: true });
      }
      if (Math.round(Number(payment.transaction_amount)) !== Number(current.amount)) {
        console.error(
          `Monto no coincide en ${reservationId}: pagado ${payment.transaction_amount}, esperado ${current.amount}`,
        );
        await logPaymentEvent(supabase, {
          reservationId,
          paymentId,
          event: "amount_mismatch",
          status: payment.status,
          amount: Math.round(Number(payment.transaction_amount)),
          detail: { expected: current.amount },
        });
        return res.status(200).json({ ignored: true });
      }

      // 4) Confirmación idempotente: solo pasa de 'hold'/'expired' a 'confirmed'.
      //    Si otra notificación simultánea ya la confirmó, `data` viene vacío y
      //    no repetimos los efectos secundarios (correos, calendario).
      const { data: confirmed, error: confirmError } = await supabase
        .from("reservations")
        .update({
          status: "confirmed",
          payment_provider: "mercadopago",
          payment_id: String(paymentId),
          hold_expires_at: null,
        })
        .eq("id", reservationId)
        .neq("status", "confirmed")
        .select("id");

      if (confirmError) {
        // 23P01 (exclusion_violation): el cupo ya fue tomado por otra reserva
        // mientras el pago se procesaba. El cliente pagó → REEMBOLSO manual.
        console.error(
          `[REEMBOLSO MANUAL] reserva ${reservationId} / pago ${paymentId}: ` +
            `cupo no disponible. ${confirmError.message}`,
        );
        await supabase
          .from("reservations")
          .update({ status: "cancelled" })
          .eq("id", reservationId)
          .neq("status", "confirmed");
        await logPaymentEvent(supabase, {
          reservationId,
          paymentId,
          event: "needs_refund",
          status: payment.status,
          amount: current.amount,
          detail: { reason: confirmError.message },
        });
        return res.status(200).json({ ok: false, needsRefund: true });
      }

      if (confirmed && confirmed.length > 0) {
        // TODO(exactamente una vez): Google Calendar + Sheets + correos.
        console.log(`Reserva confirmada: ${reservationId} (pago ${paymentId})`);
        await logPaymentEvent(supabase, {
          reservationId,
          paymentId,
          event: "confirmed",
          status: payment.status,
          amount: current.amount,
        });
      }
      return res.status(200).json({ ok: true });
    }

    // PSE tarda: el cliente sigue en el portal del banco. Estiramos el hold.
    if (["pending", "in_process", "authorized"].includes(payment.status)) {
      await supabase
        .from("reservations")
        .update({ hold_expires_at: new Date(Date.now() + 30 * 60000).toISOString() })
        .eq("id", reservationId)
        .eq("status", "hold");
      await logPaymentEvent(supabase, {
        reservationId,
        paymentId,
        event: "pending",
        status: payment.status,
      });
      return res.status(200).json({ ok: true, pending: true });
    }

    if (["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status)) {
      // Libera el cupo (solo si aún era un hold, nunca una reserva confirmada).
      await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", reservationId)
        .eq("status", "hold");
      await logPaymentEvent(supabase, {
        reservationId,
        paymentId,
        event: "rejected",
        status: payment.status,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("webhook-mercadopago:", err);
    return res.status(500).json({ error: "Error procesando la notificación" });
  }
}
