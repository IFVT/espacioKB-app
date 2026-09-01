-- Bitácora del keepalive: una fila por cada ejecución del cron.
-- Sirve para (1) verificar que el ping realmente corre día a día y
-- (2) generar una ESCRITURA (cuenta más como actividad que una lectura).
-- Correr en Supabase → SQL Editor.

create table if not exists keepalive_log (
  id bigint generated always as identity primary key,
  pinged_at timestamptz not null default now()
);

-- Igual que el resto: RLS activo sin políticas → solo la service_key entra.
alter table keepalive_log enable row level security;
