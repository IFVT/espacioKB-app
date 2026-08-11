import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SPACES } from "./_lib/spaces.js";
import { getSupabase } from "./_lib/supabase.js";
import { BadRequest, validateBooking, validateCustomer } from "./_lib/booking.js";
import { mpFetch } from "./_lib/mp.js";
import { logPaymentEvent } from "./_lib/audit.js";

// PSE manda al cliente al portal de su banco (login, clave, a veces token), así
// que 15 min se quedaban cortos. 30 da margen sin bloquear el cupo de más.
const HOLD_MINUTES = 30;

/**
 * POST /api/create-payment
 * Revalida todo en el servidor, crea el hold (la base garantiza que el cupo no
 * esté tomado) y devuelve la URL de checkout.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  let booking, customer;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    booking = validateBooking(body);
    customer = validateCustomer(body?.customer);
  } catch (err) {
    if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
    return res.status(400).json({ error: "Solicitud inválida" });
  }

  // Si aún no hay credenciales de Mercado Pago, no creamos hold ni ensuciamos la
  // base: respondemos un mensaje claro. Se quita solo cuando exista el token.
  if (!process.env.MP_ACCESS_TOKEN || !process.env.PUBLIC_BASE_URL) {
    return res
      .status(503)
      .json({ error: "El pago en línea está en configuración. Vuelve a intentarlo pronto." });
  }

  const supabase = getSupabase();

  // 1) Hold. Si el cupo ya está tomado, la restricción de exclusión lo rechaza.
  const { data: holdRows, error: holdError } = await supabase.rpc("create_hold", {
    p_space: booking.space,
    p_date: booking.date,
    p_start: booking.start_time,
    p_hours: booking.hours,
    p_extras: booking.extras,
    p_amount: booking.amount,
    p_name: customer.name,
    p_phone: customer.phone,
    p_email: customer.email,
    p_hold_minutes: HOLD_MINUTES,
  });

  if (holdError) {
    if (String(holdError.message).includes("SLOT_TAKEN")) {
      return res
        .status(409)
        .json({ error: "Ese horario acaba de ser reservado. Elige otra hora." });
    }
    console.error("create_hold:", holdError);
    return res.status(500).json({ error: "No se pudo crear la reserva" });
  }

  const reservation = Array.isArray(holdRows) ? holdRows[0] : holdRows;
  if (!reservation?.id) {
    return res.status(500).json({ error: "No se pudo crear la reserva" });
  }

  await logPaymentEvent(supabase, {
    reservationId: reservation.id,
    event: "hold_created",
    amount: booking.amount,
    detail: {
      space: booking.space,
      date: booking.date,
      start: booking.start_time,
      hours: booking.hours,
      extras: booking.extras,
    },
  });

  // 2) Preferencia de Mercado Pago (Checkout Pro).
  try {
    const baseUrl = process.env.PUBLIC_BASE_URL;
    const token = process.env.MP_ACCESS_TOKEN;
    if (!baseUrl || !token) throw new Error("Faltan PUBLIC_BASE_URL / MP_ACCESS_TOKEN");

    const space = SPACES[booking.space];
    const mpRes = await mpFetch("/checkout/preferences", {
      method: "POST",
      // Evita preferencias duplicadas si el cliente reintenta el mismo hold.
      headers: { "X-Idempotency-Key": reservation.id },
      body: JSON.stringify({
        items: [
          {
            title: `${space.name} · ${booking.hours}h · ${booking.date} ${booking.start_time}`,
            quantity: 1,
            currency_id: "COP",
            unit_price: booking.amount,
          },
        ],
        payer: { name: customer.name, email: customer.email },
        // Solo PSE (bank_transfer) y tarjeta. Se excluye el pago en efectivo
        // (Efecty y similares): el cliente puede tardar DÍAS en pagarlo, y para
        // entonces el hold ya expiró y el cupo se vendió a otra persona.
        payment_methods: {
          excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
        },
        statement_descriptor: "ESPACIO KB",
        // Enlaza el pago con la reserva; es lo que lee el webhook.
        external_reference: reservation.id,
        notification_url: `${baseUrl}/api/webhook-mercadopago`,
        back_urls: {
          success: `${baseUrl}/?pago=ok`,
          failure: `${baseUrl}/?pago=error`,
          pending: `${baseUrl}/?pago=pendiente`,
        },
        auto_return: "approved",
        // Sin binary_mode a propósito: PSE devuelve "pending" de forma legítima
        // mientras el banco procesa, y forzar aprobado/rechazado lo rompería.
        // Que la preferencia caduque junto con el hold.
        expires: true,
        expiration_date_to: new Date(Date.now() + HOLD_MINUTES * 60000).toISOString(),
      }),
    });

    if (!mpRes.ok) {
      throw new Error(`Mercado Pago respondió ${mpRes.status}: ${await mpRes.text()}`);
    }
    const pref = (await mpRes.json()) as { id: string; init_point: string };

    await supabase
      .from("reservations")
      .update({ payment_provider: "mercadopago", payment_id: pref.id })
      .eq("id", reservation.id);

    await logPaymentEvent(supabase, {
      reservationId: reservation.id,
      paymentId: pref.id,
      event: "preference_created",
      amount: booking.amount,
    });

    return res.status(200).json({
      reservationId: reservation.id,
      checkoutUrl: pref.init_point,
      amount: booking.amount,
    });
  } catch (err) {
    // Si falla la pasarela, liberamos el cupo en vez de dejarlo bloqueado.
    console.error("create-payment:", err);
    await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", reservation.id)
      .neq("status", "confirmed");
    await logPaymentEvent(supabase, {
      reservationId: reservation.id,
      event: "gateway_error",
      detail: { message: String(err) },
    });
    return res.status(502).json({ error: "No se pudo iniciar el pago" });
  }
}
