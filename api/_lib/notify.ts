import crypto from "node:crypto"
import { SPACES, type SpaceId } from "./spaces.js"
import { formatTime } from "./time.js"

// ---------------------------------------------------------------------------
// Notificaciones al confirmarse una reserva: correo (Resend) + evento en Google
// Calendar. TODO es best-effort: si falta una credencial o falla la llamada,
// se lanza el error para que el webhook lo registre, pero NUNCA se rompe el
// flujo de pago (el webhook las envuelve en try/catch).
// ---------------------------------------------------------------------------

export interface ConfirmedReservation {
  id: string
  space: SpaceId
  date: string // YYYY-MM-DD
  start_time: string // "HH:MM:SS" o "HH:MM"
  hours: number
  extras: unknown
  amount: number
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
}

const COP = (n: number) => "$" + n.toLocaleString("es-CO")
const pad = (n: number) => String(n).padStart(2, "0")

function spaceName(space: SpaceId): string {
  return SPACES[space]?.name ?? space
}

function extraNames(space: SpaceId, extras: unknown): string[] {
  if (!Array.isArray(extras)) return []
  const catalog = SPACES[space]?.extras ?? []
  return extras
    .map((id) => catalog.find((e) => e.id === id)?.name ?? String(id))
}

/** Inicio y fin como ISO con offset fijo de Bogotá (-05:00), manejando el
 *  cruce de medianoche (p.ej. 22:00 + 3h). */
function bogotaRange(date: string, startTime: string, hours: number) {
  const [y, m, d] = date.split("-").map(Number)
  const sh = Number(startTime.slice(0, 2))
  const sm = Number(startTime.slice(3, 5))
  const start = new Date(Date.UTC(y, m - 1, d, sh, sm)) // se trata como hora de pared
  const end = new Date(start.getTime() + hours * 3600 * 1000)
  const fmt = (dt: Date) =>
    `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` +
    `T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:00-05:00`
  return { startISO: fmt(start), endISO: fmt(end) }
}

// ---------------------------------------------------------------------------
// Correo (Resend REST API)
// ---------------------------------------------------------------------------

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.NOTIFY_FROM ?? "Espacio KB <reservas@reservasespaciokb.org>"
  if (!key) return // sin credencial: no-op silencioso
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

/** Envía el correo al negocio (NOTIFY_EMAIL) y, si hay, al cliente. */
export async function sendConfirmationEmails(r: ConfirmedReservation): Promise<void> {
  const negocio = process.env.NOTIFY_EMAIL
  if (!process.env.RESEND_API_KEY || (!negocio && !r.customer_email)) return

  const sName = spaceName(r.space)
  const extras = extraNames(r.space, r.extras)
  const hora = formatTime(r.start_time)
  const extrasHtml = extras.length ? `<p><b>Extras:</b> ${extras.join(", ")}</p>` : ""

  const detalle = `
    <p><b>Espacio:</b> ${sName}</p>
    <p><b>Fecha:</b> ${r.date}</p>
    <p><b>Hora:</b> ${hora} · ${r.hours}h</p>
    ${extrasHtml}
    <p><b>Pagado en línea:</b> ${COP(r.amount)}</p>`

  // Al negocio (Davide)
  if (negocio) {
    await sendEmail(
      negocio,
      `Nueva reserva · ${sName} · ${r.date} ${hora}`,
      `<h2>Nueva reserva confirmada</h2>${detalle}
       <p><b>Cliente:</b> ${r.customer_name ?? "-"}<br/>
          <b>Tel:</b> ${r.customer_phone ?? "-"}<br/>
          <b>Email:</b> ${r.customer_email ?? "-"}</p>
       <p style="color:#888">Reserva ${r.id}</p>`,
    )
  }

  // Al cliente
  if (r.customer_email) {
    await sendEmail(
      r.customer_email,
      `Tu reserva en Espacio KB quedó confirmada`,
      `<h2>¡Reserva confirmada! 🎉</h2>
       <p>Hola ${r.customer_name ?? ""}, tu reserva quedó lista:</p>${detalle}
       <p>Te esperamos. Si necesitas algo, responde a este correo.</p>`,
    )
  }
}

// ---------------------------------------------------------------------------
// Google Calendar (cuenta de servicio → JWT → token → insertar evento)
// ---------------------------------------------------------------------------

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

async function getGoogleToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = b64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  )
  const signingInput = `${header}.${claim}`
  const signature = b64url(crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey))
  const jwt = `${signingInput}.${signature}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`Google token ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

/** Crea un evento en el Google Calendar del negocio para la reserva. */
export async function addCalendarEvent(r: ConfirmedReservation): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n")
  if (!calendarId || !email || !privateKey) return // sin credenciales: no-op

  const token = await getGoogleToken(email, privateKey)
  const { startISO, endISO } = bogotaRange(r.date, r.start_time, r.hours)
  const sName = spaceName(r.space)
  const extras = extraNames(r.space, r.extras)

  const event = {
    summary: `${sName} · ${r.customer_name ?? "Reserva"}`,
    description:
      `Reserva Espacio KB\n` +
      `Espacio: ${sName}\n` +
      `Cliente: ${r.customer_name ?? "-"}\n` +
      `Tel: ${r.customer_phone ?? "-"}\n` +
      `Email: ${r.customer_email ?? "-"}\n` +
      `Horas: ${r.hours}\n` +
      (extras.length ? `Extras: ${extras.join(", ")}\n` : "") +
      `Pagado: ${COP(r.amount)}\n` +
      `Reserva: ${r.id}`,
    start: { dateTime: startISO, timeZone: "America/Bogota" },
    end: { dateTime: endISO, timeZone: "America/Bogota" },
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    },
  )
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${await res.text()}`)
}
