# Espacio KB — reservas

Aplicación de reservas para Espacio KB (Bogotá): el cliente elige espacio, duración,
fecha y hora, agrega equipos si aplica y paga en línea. En producción en
[reservasespaciokb.org](https://reservasespaciokb.org).

## Stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v4** (vía `@tailwindcss/vite`)
- **GSAP** para las animaciones de la interfaz
- **Supabase** como base de datos de reservas
- **Mercado Pago** para el pago en línea (Checkout Pro + webhook)
- **Resend** para los avisos por correo
- Funciones serverless de **Vercel** en `/api`

## Arranque

```bash
npm install
cp .env.example .env.local   # rellenar las claves
npm run dev                  # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | Sirve el build |
| `npm run lint` | ESLint |

**`vite dev` no ejecuta las funciones de `/api`.** Para poder recorrer el flujo completo
sin backend, `src/lib/api.ts` cae a un mock local cuando la petición falla y estamos en
desarrollo. En producción no hay mock: si el backend falla, el error se propaga. La
excepción es desplegar con `VITE_DEMO=true`, pensado para un enlace de muestra sin
credenciales.

## Estructura

```
api/                  funciones serverless (no se importan desde src/)
├── availability.ts       horarios libres de una fecha
├── create-payment.ts     crea la reserva y la preferencia de pago
├── webhook-mercadopago.ts confirmación de pago
├── reservation-status.ts estado de la reserva tras volver de la pasarela
├── keepalive.ts          cron diario (ver vercel.json)
└── _lib/                 spaces, pricing, time, booking, supabase, mp, notify, audit

src/
├── components/       un componente por paso del flujo (StepHours, StepSchedule, …)
├── data/spaces.ts    re-export de api/_lib/spaces
└── lib/              api, pricing, time, types
```

## Cómo funciona una reserva

1. **Espacio.** Se entra por enlace directo (`?espacio=karaoke` o `?espacio=casita`); sin
   parámetro válido se muestra un landing para elegir.
2. **Horas.** Entre 2 y 7. Karaoke arranca en 3 h; el resto en 2 h.
3. **Fecha y hora.** `GET /api/availability` devuelve todas las horas de inicio del día
   con su estado (`free` / `taken` / `unavailable`), calculado contra las reservas
   existentes, el horario de apertura y el buffer entre reservas.
4. **Equipos.** Paso condicional: solo existe para La Casita de Renata.
5. **Datos del cliente** y resumen con el total.
6. **Pago.** `POST /api/create-payment` crea la reserva en Supabase y devuelve la URL de
   Checkout Pro. Mercado Pago regresa a `/?pago=…&external_reference=<id>` y el webhook
   confirma el estado; la app lo verifica con `/api/reservation-status`.

## Decisiones de implementación

**Una sola fuente de verdad para espacios, precios y horarios.** Vive en
`api/_lib/spaces.ts` y el frontend la re-exporta desde `src/data/spaces.ts`. Las funciones
de Vercel no pueden importar fuera de `/api`, así que la dirección de la dependencia va
del front hacia la API y nunca al revés. Así el precio que ve el cliente y el que se cobra
no pueden desincronizarse.

**El total se recalcula en el servidor.** El cliente nunca envía el monto: `create-payment`
lo vuelve a calcular con los mismos datos antes de crear la preferencia de pago.

**La `service_role` de Supabase es solo de servidor.** Salta las políticas de RLS, así que
nunca se expone al navegador; el front solo habla con `/api`.

**Cron de mantenimiento.** `vercel.json` programa `/api/keepalive` una vez al día para
evitar que el proyecto de Supabase se suspenda por inactividad.

## Variables de entorno

Ver `.env.example`. Las obligatorias para el flujo completo:

| Variable | Notas |
|---|---|
| `SUPABASE_URL` | Proyecto de Supabase |
| `SUPABASE_SERVICE_KEY` | `service_role`. **Solo servidor** |
| `MP_ACCESS_TOKEN` | Mercado Pago |
| `RESEND_API_KEY` | Envío de avisos |
| `NOTIFY_EMAIL` / `NOTIFY_FROM` | Destinatario y remitente del aviso de nueva reserva |
| `PUBLIC_BASE_URL` | URL pública del despliegue, sin barra final |

Las claves de Google (Calendar y Sheets) están declaradas pero su integración sigue
pendiente.

Nunca subas un `.env` con valores reales: `.gitignore` ya bloquea `.env.*` y deja pasar
solo `.env.example`. En Vercel se cargan en **Settings → Environment Variables**.

## Despliegue

Vercel, con el repositorio conectado. El build es `npm run build` y las funciones de
`/api` se despliegan solas. Recuerda configurar las variables de entorno y apuntar
`PUBLIC_BASE_URL` al dominio de producción, porque de ahí salen las `back_urls` y el
`notification_url` de Mercado Pago.
