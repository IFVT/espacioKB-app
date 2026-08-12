import type { VercelRequest, VercelResponse } from "@vercel/node";
import { mpFetch } from "./_lib/mp.js";

// Diagnóstico TEMPORAL (solo modo prueba). Busca en Mercado Pago los pagos
// asociados a una reserva (external_reference) y devuelve status + status_detail
// para entender POR QUÉ un pago fue rechazado en sandbox. No expone datos
// personales. Quitar/deshabilitar antes de producción — de hecho responde 404
// si MP_MODE !== "test".
interface MpPayment {
  id: number
  status: string
  status_detail: string
  transaction_amount: number
  currency_id: string
  payment_method_id: string
  payment_type_id: string
  date_created: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (process.env.MP_MODE !== "test") {
    return res.status(404).json({ error: "No disponible" })
  }

  // ?account=1 → devuelve de QUIÉN es el token (para saber si es la cuenta de
  // prueba correcta del vendedor). No expone el token, solo datos de la cuenta.
  if (req.query.account) {
    try {
      const r = await mpFetch("/users/me")
      if (!r.ok) return res.status(502).json({ error: `MP ${r.status}`, body: await r.text() })
      const u = (await r.json()) as {
        id: number
        nickname: string
        site_id: string
        country_id: string
        tags?: string[]
        registration_date?: string
      }
      return res.status(200).json({
        account: {
          id: u.id,
          nickname: u.nickname,
          site_id: u.site_id,
          country_id: u.country_id,
          tags: u.tags ?? [],
          is_test_user: (u.tags ?? []).includes("test_user"),
          registration_date: u.registration_date,
        },
      })
    } catch (err) {
      console.error("debug-payment account:", err)
      return res.status(500).json({ error: String(err) })
    }
  }

  // ?minpref=1 → crea la preferencia MÁS simple posible y devuelve sus init_points.
  // Sirve para aislar si el fallo del checkout es por un campo de nuestra
  // preferencia o por la cuenta/config de Mercado Pago.
  if (req.query.minpref) {
    try {
      const baseUrl = process.env.PUBLIC_BASE_URL ?? ""
      const r = await mpFetch("/checkout/preferences", {
        method: "POST",
        body: JSON.stringify({
          items: [{ title: "Prueba", quantity: 1, unit_price: 1000, currency_id: "COP" }],
          back_urls: { success: `${baseUrl}/?pago=ok` },
        }),
      })
      const body = (await r.json()) as {
        id?: string
        init_point?: string
        sandbox_init_point?: string
      }
      return res.status(r.ok ? 200 : 502).json({
        ok: r.ok,
        status: r.status,
        id: body.id,
        init_point: body.init_point,
        sandbox_init_point: body.sandbox_init_point,
        raw: r.ok ? undefined : body,
      })
    } catch (err) {
      console.error("debug-payment minpref:", err)
      return res.status(500).json({ error: String(err) })
    }
  }

  // ?recent=1 → últimos pagos de la cuenta (sin filtrar por reserva), para ver
  // si algún intento llegó a crear pago y con qué status_detail se rechazó.
  const ref = String(req.query.ref ?? req.query.id ?? "")
  if (!ref && !req.query.recent) {
    return res.status(400).json({ error: "Falta ?ref=<external_reference> o ?recent=1" })
  }

  try {
    const query = req.query.recent
      ? `/v1/payments/search?sort=date_created&criteria=desc&limit=15`
      : `/v1/payments/search?external_reference=${encodeURIComponent(ref)}&sort=date_created&criteria=desc`
    const r = await mpFetch(query)
    if (!r.ok) {
      return res.status(502).json({ error: `MP respondió ${r.status}`, body: await r.text() })
    }
    const data = (await r.json()) as { results?: MpPayment[] }
    const payments = (data.results ?? []).map((p) => ({
      id: p.id,
      status: p.status,
      status_detail: p.status_detail,
      amount: p.transaction_amount,
      currency: p.currency_id,
      method: `${p.payment_type_id}/${p.payment_method_id}`,
      created: p.date_created,
    }))

    res.setHeader("Cache-Control", "no-store")
    return res.status(200).json({ external_reference: ref, count: payments.length, payments })
  } catch (err) {
    console.error("debug-payment:", err)
    return res.status(500).json({ error: String(err) })
  }
}
