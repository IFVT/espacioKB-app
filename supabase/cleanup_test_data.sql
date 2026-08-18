-- Limpieza de datos de PRUEBA antes de salir a producción.
-- Borra TODAS las reservas y su bitácora. Ejecutar SOLO antes del lanzamiento,
-- cuando aún no hay reservas reales de clientes.
--
-- Correr en Supabase → SQL Editor.

delete from payment_events;
delete from reservations;

-- Verificación (deben dar 0):
select count(*) as reservas from reservations;
select count(*) as eventos  from payment_events;
