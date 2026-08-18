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

  // ?tokenhead=1 → primeros caracteres del token en uso (para verificar si la
  // variable de entorno realmente cambió). NO expone el secreto (solo el prefijo
  // público APP_USR-<clientid>).
  if (req.query.tokenhead) {
    const tk = process.env.MP_ACCESS_TOKEN ?? ""
    return res.status(200).json({
      head: tk.slice(0, 16),
      length: tk.length,
      mp_mode: process.env.MP_MODE ?? null,
    })
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

  // ?pay=<external_reference>[&amount=180000] → completa un pago de PRUEBA por la
  // API (tokeniza la tarjeta de prueba de CO con titular APRO y crea el pago),
  // para verificar el webhook sin pasar por la UI del checkout.
  if (req.query.pay) {
    try {
      const ref = String(req.query.pay)
      const amount = Number(req.query.amount ?? 180000)
      const baseUrl = process.env.PUBLIC_BASE_URL ?? ""

      const pk = String(req.query.pk ?? "")
      const cardBody = JSON.stringify({
        card_number: "5254133674403564",
        expiration_month: 11,
        expiration_year: 2030,
        security_code: "123",
        cardholder: { name: "APRO", identification: { type: "CC", number: "123456789" } },
      })
      // El card_token se crea con la PUBLIC KEY (contexto de prueba), no con el
      // access token. Si se pasa ?pk=, se usa esa vía; si no, cae a mpFetch.
      const tokRes = pk
        ? await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(pk)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: cardBody,
          })
        : await mpFetch("/v1/card_tokens", { method: "POST", body: cardBody })
      const tok = (await tokRes.json()) as { id?: string }
      if (!tokRes.ok || !tok.id) {
        return res.status(502).json({ step: "card_token", status: tokRes.status, body: tok })
      }

      const payRes = await mpFetch("/v1/payments", {
        method: "POST",
        headers: { "X-Idempotency-Key": `debug-${ref}-${Date.now()}` },
        body: JSON.stringify({
          transaction_amount: amount,
          token: tok.id,
          description: "Debug test payment",
          installments: 1,
          payment_method_id: "master",
          payer: { email: "test_user_debug@testuser.com" },
          external_reference: ref,
          notification_url: `${baseUrl}/api/webhook-mercadopago`,
        }),
      })
      const pay = (await payRes.json()) as {
        id?: number
        status?: string
        status_detail?: string
      }
      return res.status(payRes.ok ? 200 : 502).json({
        step: "payment",
        http: payRes.status,
        id: pay.id,
        payment_status: pay.status,
        status_detail: pay.status_detail,
        raw: payRes.ok ? undefined : pay,
      })
    } catch (err) {
      console.error("debug-payment pay:", err)
      return res.status(500).json({ error: String(err) })
    }
  }

  // ?fullpref=1[&drop=campo1,campo2] → crea una preferencia igual a la real y
  // permite OMITIR campos para bisectar cuál rompe el checkout (COW00).
  if (req.query.fullpref) {
    try {
      const baseUrl = process.env.PUBLIC_BASE_URL ?? ""
      const drop = new Set(String(req.query.drop ?? "").split(",").map((s) => s.trim()))
      const expISO = new Date(Date.now() + 30 * 60000).toISOString()

      const pref: Record<string, unknown> = {
        items: [
          { title: "Karaoke · 2h · 2026-08-30 18:00", quantity: 1, currency_id: "COP", unit_price: 180000 },
        ],
      }
      if (!drop.has("payer")) pref.payer = { name: "Comprador Prueba", email: "test_user_x@testuser.com" }
      if (!drop.has("payment_methods")) {
        pref.payment_methods = { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] }
      }
      if (!drop.has("statement_descriptor")) pref.statement_descriptor = "ESPACIO KB"
      if (!drop.has("external_reference")) pref.external_reference = "debug-fullpref"
      if (!drop.has("notification_url")) pref.notification_url = `${baseUrl}/api/webhook-mercadopago`
      if (!drop.has("back_urls")) {
        pref.back_urls = {
          success: `${baseUrl}/?pago=ok`,
          failure: `${baseUrl}/?pago=error`,
          pending: `${baseUrl}/?pago=pendiente`,
        }
        if (!drop.has("auto_return")) pref.auto_return = "approved"
      }
      if (!drop.has("expires")) {
        pref.expires = true
        pref.expiration_date_to = expISO
      }

      const r = await mpFetch("/checkout/preferences", {
        method: "POST",
        body: JSON.stringify(pref),
      })
      const body = (await r.json()) as { id?: string; init_point?: string }
      return res.status(r.ok ? 200 : 502).json({
        ok: r.ok,
        status: r.status,
        dropped: [...drop].filter(Boolean),
        id: body.id,
        init_point: body.init_point,
        raw: r.ok ? undefined : body,
      })
    } catch (err) {
      console.error("debug-payment fullpref:", err)
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
