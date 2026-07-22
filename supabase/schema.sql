-- ===========================================================================
-- Espacio KB · esquema de reservas
-- Pegar completo en el SQL editor de Supabase (es idempotente, se puede
-- volver a correr).
--
-- Zona horaria: todo se guarda en HORA LOCAL DE BOGOTÁ (Colombia es UTC-5 fijo,
-- sin horario de verano), por eso se usa `timestamp` sin zona y no `timestamptz`.
-- ===========================================================================

-- Necesario para combinar igualdad (space) con solapamiento de rangos (during)
-- dentro de una misma restricción de exclusión.
create extension if not exists btree_gist;

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  space text not null check (space in ('karaoke', 'casita')),
  "date" date not null,
  start_time time not null,
  hours int not null check (hours between 2 and 7),

  -- Rango ocupado = [inicio, fin + buffer). Al incluir el buffer en el propio
  -- rango, dos reservas "se tocan" solo si violan la separación mínima.
  -- OJO: el 30 debe coincidir con SCHEDULE.bufferMinutes del frontend.
  during tsrange generated always as (
    tsrange(
      ("date" + start_time),
      ("date" + start_time) + (hours * interval '1 hour') + interval '30 minutes',
      '[)'
    )
  ) stored,

  -- Cosmético/para reportes. La fuente de verdad del solapamiento es `during`
  -- (end_time da la vuelta a 00:00 cuando la reserva termina a medianoche).
  end_time time generated always as (
    (start_time + (hours * interval '1 hour'))
  ) stored,

  extras jsonb not null default '[]',
  amount int not null,                       -- COP cobrados EN LÍNEA
  status text not null default 'hold'
    check (status in ('hold', 'confirmed', 'expired', 'cancelled')),
  hold_expires_at timestamptz,

  customer_name text,
  customer_phone text,
  customer_email text,

  payment_provider text check (payment_provider in ('mercadopago', 'bold')),
  payment_id text,

  created_at timestamptz not null default now()
);

create index if not exists reservations_space_date_idx on reservations (space, "date");
create index if not exists reservations_payment_idx on reservations (payment_provider, payment_id);

-- ---------------------------------------------------------------------------
-- GARANTÍA ANTI-DOBLE-RESERVA
-- Esto es lo que hace imposible vender el mismo cupo dos veces, incluso si dos
-- pagos entran en el mismo milisegundo: la segunda inserción es rechazada por
-- la base, no por el código de la app.
--
-- No se puede filtrar por `hold_expires_at > now()` aquí (Postgres exige
-- expresiones inmutables en el WHERE de una restricción), por eso los holds
-- vencidos se liberan explícitamente en create_hold() antes de insertar.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reservations_no_overlap'
  ) then
    alter table reservations
      add constraint reservations_no_overlap
      exclude using gist (space with =, during with &&)
      where (status in ('hold', 'confirmed'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: sin políticas = nadie entra con la clave anónima.
-- Solo la service_key (usada únicamente desde las funciones de Vercel) pasa.
-- ---------------------------------------------------------------------------
alter table reservations enable row level security;

-- ---------------------------------------------------------------------------
-- create_hold: libera holds vencidos e inserta el nuevo, todo en una sola
-- transacción. Si el cupo ya está tomado lanza SLOT_TAKEN.
-- ---------------------------------------------------------------------------
create or replace function create_hold(
  p_space text,
  p_date date,
  p_start time,
  p_hours int,
  p_extras jsonb,
  p_amount int,
  p_name text,
  p_phone text,
  p_email text,
  p_hold_minutes int default 15
) returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  r reservations;
begin
  update reservations
     set status = 'expired'
   where status = 'hold'
     and hold_expires_at is not null
     and hold_expires_at < now();

  insert into reservations (
    space, "date", start_time, hours, extras, amount,
    status, hold_expires_at,
    customer_name, customer_phone, customer_email
  ) values (
    p_space, p_date, p_start, p_hours, coalesce(p_extras, '[]'::jsonb), p_amount,
    'hold', now() + make_interval(mins => p_hold_minutes),
    p_name, p_phone, p_email
  )
  returning * into r;

  return r;
exception
  when exclusion_violation then
    raise exception 'SLOT_TAKEN';
end $$;

-- ---------------------------------------------------------------------------
-- taken_ranges: franjas ocupadas de un espacio en una fecha (holds vigentes +
-- confirmadas). La usa /api/availability para descartar horas de inicio.
-- ---------------------------------------------------------------------------
create or replace function taken_ranges(p_space text, p_date date)
returns table (start_at timestamp, end_at timestamp)
language sql
stable
security definer
set search_path = public
as $$
  select lower(during), upper(during)
    from reservations
   where space = p_space
     and "date" = p_date
     and (
       status = 'confirmed'
       or (status = 'hold' and hold_expires_at > now())
     );
$$;
