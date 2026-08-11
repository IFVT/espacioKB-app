-- ===========================================================================
-- Bitácora de auditoría de pagos.
-- Pegar en el SQL editor de Supabase (idempotente). Registra cada evento
-- relevante del ciclo de pago para conciliación y disputas.
-- ===========================================================================

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid,          -- sin FK a propósito: la auditoría nunca debe fallar
  payment_id text,
  event text not null,          -- hold_created | preference_created | payment_approved |
                                -- confirmed | amount_mismatch | currency_mismatch |
                                -- needs_refund | pending | rejected | gateway_error | ...
  status text,                  -- estado reportado por Mercado Pago
  amount int,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists payment_events_reservation_idx on payment_events (reservation_id);
create index if not exists payment_events_created_idx on payment_events (created_at desc);

-- RLS sin políticas: solo la service_key (servidor) escribe/lee.
alter table payment_events enable row level security;
