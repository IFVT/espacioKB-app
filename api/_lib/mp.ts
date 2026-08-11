import crypto from "node:crypto";
import type { VercelRequest } from "@vercel/node";

const MP_BASE = "https://api.mercadopago.com";

/**
 * fetch a la API de Mercado Pago con token y timeout. Sin timeout, una demora
 * de MP dejaría la función colgada hasta el límite de Vercel.
 */
export async function mpFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Falta MP_ACCESS_TOKEN");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${MP_BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verifica la firma `x-signature` de Mercado Pago (HMAC-SHA256 sobre un
 * manifiesto con el id de la notificación, el x-request-id y el timestamp).
 *
 * - Si `MP_WEBHOOK_SECRET` NO está configurado, devuelve `true` (modo de
 *   transición, para no romper antes de configurarlo) — pero hay que definirlo
 *   sí o sí antes de cobrar en real.
 * - Con el secreto configurado, una firma inválida devuelve `false`.
 */
export function verifyWebhookSignature(req: VercelRequest): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;

  const sigHeader = req.headers["x-signature"];
  const reqId = req.headers["x-request-id"];
  if (typeof sigHeader !== "string" || typeof reqId !== "string") return false;

  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const idx = kv.indexOf("=");
    if (idx > 0) parts[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
  }
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const rawId = req.query["data.id"];
  const dataId = Array.isArray(rawId) ? rawId[0] : rawId;
  const manifest = dataId
    ? `id:${String(dataId).toLowerCase()};request-id:${reqId};ts:${ts};`
    : `request-id:${reqId};ts:${ts};`;

  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}
