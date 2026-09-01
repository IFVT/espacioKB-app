// Formatea una hora "HH:MM" (o "HH:00") de 24h a 12h con a.m./p.m.
// Ej.: "19:00" → "7:00 p.m." · "00:00" → "12:00 a.m." · "12:00" → "12:00 p.m."
// Si el valor viene vacío/ inválido, lo devuelve tal cual (sin romper la UI).
export function formatTime(t: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "")
  if (!m) return t ?? ""
  const h = Number(m[1]) % 24
  const period = h < 12 ? "a.m." : "p.m."
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m[2]} ${period}`
}

// Rango de inicio → fin (inicio + duración). Ej.: ("19:00", 2) → "7:00 p.m. – 9:00 p.m."
// El fin puede cruzar la medianoche: ("23:00", 3) → "11:00 p.m. – 2:00 a.m.".
export function formatRange(startTime: string | null | undefined, hours: number): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(startTime ?? "")
  if (!m) return formatTime(startTime)
  const endHour = Number(m[1]) + hours
  const endTime = `${String(endHour).padStart(2, "0")}:${m[2]}`
  return `${formatTime(startTime)} – ${formatTime(endTime)}`
}
