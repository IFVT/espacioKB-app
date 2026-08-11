import type { VercelRequest, VercelResponse } from "@vercel/node";

// Endpoint de diagnóstico SIN imports en tiempo de ejecución. Si /api/ping
// responde pero los demás fallan, el problema está en los imports; si /api/ping
// también falla, es config de las funciones (ESM) en Vercel.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ pong: true, node: process.version });
}
