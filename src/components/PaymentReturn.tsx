import { useEffect, useState } from "react";
import { getReservationStatus } from "../lib/api";
import MagneticButton from "./MagneticButton";

interface Props {
  pago: string; // ok | pendiente | error | (otro)
  reservationId: string | null;
}

// Pantalla a la que vuelve el cliente desde Mercado Pago. La confirmación real
// llega por el webhook (async), así que aquí consultamos el estado real de la
// reserva unas cuantas veces antes de dar un mensaje definitivo. NUNCA se confía
// en el "status" que trae la URL (es del navegador, falsificable).
export default function PaymentReturn({ pago, reservationId }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [done, setDone] = useState(false); // dejamos de consultar

  const shouldPoll = (pago === "ok" || pago === "pendiente") && !!reservationId;

  useEffect(() => {
    if (!shouldPoll || !reservationId) {
      setDone(true);
      return;
    }
    let active = true;
    let n = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!active) return;
      const s = await getReservationStatus(reservationId);
      if (!active) return;
      if (s) setStatus(s);
      n += 1;
      if (s === "confirmed" || s === "cancelled" || n >= 10) {
        setDone(true);
        return;
      }
      timer = setTimeout(tick, 3000);
    };
    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [shouldPoll, reservationId]);

  let icon = "⏳";
  let iconBg = "bg-accent";
  let title = "Estamos confirmando tu pago…";
  let message =
    "Esto puede tardar unos minutos (con PSE, el banco a veces demora). Te enviaremos un correo al confirmarse.";

  if (pago === "error" || status === "cancelled") {
    icon = "✕";
    iconBg = "bg-[#e30613]";
    title = status === "cancelled" ? "Hubo un problema con tu reserva" : "El pago no se completó";
    message =
      status === "cancelled"
        ? "Si se te realizó un cobro, te haremos la devolución. Escríbenos para ayudarte."
        : "No se procesó el pago. Puedes intentarlo de nuevo cuando quieras.";
  } else if (status === "confirmed") {
    icon = "✓";
    iconBg = "bg-ok";
    title = "¡Reserva confirmada!";
    message = "Recibimos tu pago. Te llegará un correo con los detalles de tu reserva.";
  } else if (pago === "pendiente" || (done && status !== "confirmed")) {
    icon = "⏳";
    iconBg = "bg-accent";
    title = "Tu pago está en proceso";
    message =
      "Cuando el banco lo confirme, tu reserva quedará lista y te avisaremos por correo. Puedes cerrar esta ventana.";
  }

  return (
    <div className="mx-auto max-w-[560px]">
      <section className="rounded-kb border border-black bg-card p-6 text-center">
        <div
          className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full text-3xl text-white ${iconBg}`}
        >
          {icon}
        </div>
        <h3 className="my-1 text-lg font-semibold">{title}</h3>
        <p className="mx-auto mb-5 max-w-[420px] text-[0.9rem] text-muted">{message}</p>
        <MagneticButton
          type="button"
          onClick={() => window.location.assign("/")}
          className="w-full rounded-xl border border-black bg-transparent p-3.5 text-base text-muted"
        >
          Volver al inicio
        </MagneticButton>
      </section>
    </div>
  );
}
