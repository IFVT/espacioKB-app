import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "./_lib/supabase";

/**
 * POST /api/webhook-mercadopago
 *
 * Nunca se confía en el cuerpo de la notificación: solo trae un id. El estado
 * real del pago se consulta contra la API de Mercado Pago con nuestro token.
 *
 * Siempre respondemos 200 salvo error nuestro: si devolvemos error, MP
 * reintenta la notificación indefinidamente.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});

    // MP notifica de varias formas según la versión/configuración.
    const type = body.type ?? body.topic ?? req.query.type ?? req.query.topic;
    const paymentId = body?.data?.id ?? body?.id ?? req.query["data.id"] ?? req.query.id;

    if (type !== "payment" || !paymentId) {
      return res.status(200).json({ ignored: true }); // p.ej. merchant_order
    }

    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error("Falta MP_ACCESS_TOKEN");

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!mpRes.ok) throw new Error(`Mercado Pago respondió ${mpRes.status}`);

    const payment = (await mpRes.json()) as {
      status: string;
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
      // Idempotencia: MP reenvía la misma notificación varias veces.
      if (current.status === "confirmed") return res.status(200).json({ ok: true });

      // El monto cobrado debe coincidir con el que calculamos nosotros.
      if (Number(payment.transaction_amount) !== Number(current.amount)) {
        console.error(
          `Monto no coincide en ${reservationId}: pagado ${payment.transaction_amount}, esperado ${current.amount}`,
        );
        return res.status(200).json({ ignored: true });
      }

      const { error: confirmError } = await supabase
        .from("reservations")
        .update({
          status: "confirmed",
          payment_provider: "mercadopago",
          payment_id: String(paymentId),
          hold_expires_at: null,
        })
        .eq("id", reservationId);

      if (confirmError) {
        // Código 23P01 = exclusion_violation. Pasa si el hold expiró (PSE puede
        // tardar) y otra persona tomó el cupo entretanto: la base impide
        // confirmarla porque ya hay una reserva solapada.
        // El cliente PAGÓ y se quedó sin sala → hay que devolverle el dinero.
        console.error(
          `[REEMBOLSO MANUAL] reserva ${reservationId} / pago ${paymentId}: ` +
            `el cupo ya no está disponible. ${confirmError.message}`,
        );
        await supabase
          .from("reservations")
          .update({ status: "cancelled" })
          .eq("id", reservationId);
        return res.status(200).json({ ok: false, needsRefund: true });
      }

      // TODO(siguiente): Google Calendar + Google Sheets + correos
      // (cliente y negocio) cuando existan las credenciales.
      return res.status(200).json({ ok: true });
    }

    // PSE tarda: el cliente sigue en el portal de su banco. Estiramos el hold
    // para no perder el cupo mientras el pago se resuelve.
    if (["pending", "in_process", "authorized"].includes(payment.status)) {
      await supabase
        .from("reservations")
        .update({ hold_expires_at: new Date(Date.now() + 30 * 60000).toISOString() })
        .eq("id", reservationId)
        .eq("status", "hold");
      return res.status(200).json({ ok: true, pending: true });
    }

    if (["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status)) {
      // Libera el cupo para que otra persona pueda tomarlo.
      await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", reservationId)
        .eq("status", "hold");
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("webhook-mercadopago:", err);
    // 500 => MP reintenta, que es lo que queremos ante un fallo transitorio.
    return res.status(500).json({ error: "Error procesando la notificación" });
  }
}
