import type { Customer } from "../lib/types";
import MagneticButton from "./MagneticButton";

interface Props {
  stepNo: number;
  customer: Customer;
  onChange: (c: Customer) => void;
  onBack: () => void;
  onNext: () => void;
}

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const phoneOk = (v: string) => v.replace(/\D/g, "").length >= 7;

export default function StepCustomer({ stepNo, customer, onChange, onBack, onNext }: Props) {
  const nameOk = customer.name.trim().length >= 2;
  const valid = nameOk && phoneOk(customer.phone) && emailOk(customer.email);

  const set = (patch: Partial<Customer>) => onChange({ ...customer, ...patch });

  const inputCls =
    "w-full rounded-xl border border-black bg-card2 p-3 text-base text-txt outline-none focus:border-accent";

  return (
    <section className="mb-4 rounded-kb border border-black bg-card p-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-2.5 cursor-pointer border-none bg-transparent p-0 text-[0.85rem] text-muted"
      >
        ← Volver
      </button>
      <h3 className="mt-0 mb-4 text-lg font-semibold">{stepNo} · Tus datos</h3>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[0.82rem] text-muted">Nombre completo</label>
          <input
            className={inputCls}
            value={customer.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Nombre y apellido"
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.82rem] text-muted">Teléfono</label>
          <input
            className={inputCls}
            value={customer.phone}
            onChange={(e) => set({ phone: e.target.value })}
            inputMode="tel"
            placeholder="300 000 0000"
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.82rem] text-muted">Correo</label>
          <input
            className={inputCls}
            value={customer.email}
            onChange={(e) => set({ email: e.target.value })}
            inputMode="email"
            placeholder="tucorreo@ejemplo.com"
          />
        </div>
      </div>

      <MagneticButton
        type="button"
        disabled={!valid}
        onClick={onNext}
        className="mt-4 block w-full rounded-xl bg-black p-3.5 text-base font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
      >
        Ver total y pagar
      </MagneticButton>
    </section>
  );
}
