import { useMemo, useState } from "react";
import type { SpaceId } from "./data/spaces";
import { SPACES } from "./data/spaces";
import { calcTotal, fmt } from "./lib/pricing";
import { createPayment } from "./lib/api";
import type { Customer } from "./lib/types";
import Stepper from "./components/Stepper";
import Landing from "./components/Landing";
import StepHours from "./components/StepHours";
import StepSchedule from "./components/StepSchedule";
import StepExtras from "./components/StepExtras";
import StepCustomer from "./components/StepCustomer";
import StepSummary from "./components/StepSummary";

type StepKey = "hours" | "schedule" | "extras" | "customer" | "summary";

const emptyCustomer: Customer = { name: "", phone: "", email: "" };

// Enlace directo: ?espacio=karaoke | casita abre el flujo de ese espacio.
// Sin parámetro válido → se muestra el Landing de respaldo (elegir espacio).
function experienceFromUrl(): SpaceId | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search).get("espacio");
  return p === "karaoke" || p === "casita" ? p : null;
}

// El paso de equipos solo existe para La Casita de Renata.
function buildSteps(spaceId: SpaceId | null): StepKey[] {
  const withExtras = spaceId === "casita";
  return ["hours", "schedule", ...(withExtras ? (["extras"] as StepKey[]) : []), "customer", "summary"];
}

export default function App() {
  const [stepKey, setStepKey] = useState<StepKey>("hours");
  const [spaceId, setSpaceId] = useState<SpaceId | null>(experienceFromUrl);
  const [hours, setHours] = useState(2);
  const [date, setDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const [acceptEquip, setAcceptEquip] = useState(false);
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [done, setDone] = useState<{ total: number } | null>(null);

  const steps = useMemo(() => buildSteps(spaceId), [spaceId]);
  const currentIndex = Math.max(0, steps.indexOf(stepKey));
  const stepNo = currentIndex + 1;

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const goNext = () => {
    if (currentIndex < steps.length - 1) setStepKey(steps[currentIndex + 1]);
    scrollTop();
  };
  const goBack = () => {
    if (currentIndex > 0) setStepKey(steps[currentIndex - 1]);
    scrollTop();
  };

  // Entrar a un espacio desde el Landing.
  const enterSpace = (id: SpaceId) => {
    setSpaceId(id);
    setStepKey("hours");
    scrollTop();
  };

  const toggleExtra = (id: string) =>
    setExtras((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const pickDate = (d: string) => {
    setDate(d);
    setStartTime(null); // cambiar día invalida la hora
  };

  const handlePay = async () => {
    if (!spaceId || !date || !startTime) return;
    setPaying(true);
    setPayError(null);
    try {
      const r = await createPayment({
        space: spaceId,
        date,
        start_time: startTime,
        hours,
        extras,
        customer,
      });

      // Con backend real se sale hacia la pasarela; la reserva solo queda
      // confirmada cuando el webhook recibe el pago aprobado.
      if (!r.mock && r.checkoutUrl && r.checkoutUrl !== "#") {
        window.location.href = r.checkoutUrl;
        return;
      }

      const { total } = calcTotal(spaceId, hours, extras);
      setDone({ total });
      scrollTop();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "No se pudo iniciar el pago");
    } finally {
      setPaying(false);
    }
  };

  const reset = () => {
    // Vuelve al mismo espacio si vino por enlace directo; al Landing si no.
    setSpaceId(experienceFromUrl());
    setStepKey("hours");
    setHours(2);
    setDate(null);
    setStartTime(null);
    setExtras([]);
    setAcceptEquip(false);
    setCustomer(emptyCustomer);
    setDone(null);
    scrollTop();
  };

  return (
    <div className="mx-auto max-w-[720px] p-4">
      <h1 className="my-1 text-2xl font-bold">Reserva tu espacio · Espacio KB</h1>
      <p className="mb-5 text-[0.9rem] text-muted">
        Elige las horas y los extras. Paga en línea y tu reserva queda confirmada.
      </p>

      {done ? (
        <section className="rounded-kb border border-line bg-card p-5 text-center">
          <div className="mx-auto mb-3.5 grid h-16 w-16 place-items-center rounded-full bg-ok text-3xl text-bg">
            ✓
          </div>
          <h3 className="my-1 text-lg font-semibold">¡Reserva confirmada!</h3>
          <p className="mb-4 text-[0.9rem] text-muted">
            {spaceId && SPACES[spaceId].name} · {date} · {startTime} · {hours}h ·{" "}
            {fmt(done.total)}. (Demostración)
          </p>
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl border border-line bg-transparent p-3.5 text-base text-muted"
          >
            Hacer otra reserva
          </button>
        </section>
      ) : spaceId === null ? (
        <Landing onPick={enterSpace} />
      ) : (
        <>
          <Stepper current={stepNo} total={steps.length} />

          {stepKey === "hours" && (
            <StepHours
              stepNo={stepNo}
              spaceId={spaceId}
              hours={hours}
              onChange={setHours}
              onNext={goNext}
            />
          )}

          {stepKey === "schedule" && (
            <StepSchedule
              stepNo={stepNo}
              spaceId={spaceId}
              hours={hours}
              date={date}
              startTime={startTime}
              onPickDate={pickDate}
              onPickTime={setStartTime}
              onBack={goBack}
              onNext={goNext}
            />
          )}

          {stepKey === "extras" && (
            <StepExtras
              stepNo={stepNo}
              spaceId={spaceId}
              selected={extras}
              acceptEquip={acceptEquip}
              onToggle={toggleExtra}
              onAcceptEquip={setAcceptEquip}
              onBack={goBack}
              onNext={goNext}
            />
          )}

          {stepKey === "customer" && (
            <StepCustomer
              stepNo={stepNo}
              customer={customer}
              onChange={setCustomer}
              onBack={goBack}
              onNext={goNext}
            />
          )}

          {stepKey === "summary" && (
            <StepSummary
              stepNo={stepNo}
              spaceId={spaceId}
              hours={hours}
              date={date}
              startTime={startTime}
              extras={extras}
              paying={paying}
              error={payError}
              onBack={goBack}
              onPay={handlePay}
            />
          )}
        </>
      )}
    </div>
  );
}
