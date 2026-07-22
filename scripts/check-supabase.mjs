/**
 * Verifica que Supabase quedó bien configurado.
 *
 *   npm run check:supabase
 *
 * Lee .env.local (nunca se sube a git). No imprime las credenciales.
 * Además de comprobar que las tablas y funciones existen, prueba de verdad la
 * garantía anti-doble-reserva creando reservas de prueba y borrándolas al final.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const CHECK_TAG = "__check__";
const TEST_DATE = "2099-01-07"; // fecha imposible: no choca con reservas reales

function loadEnv(file = ".env.local") {
  let raw;
  try {
    raw = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  } catch {
    fail(`No se encontró ${file}. Cópialo de .env.example y rellena los valores.`);
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
function fail(m) {
  console.error(`\n\x1b[31m${m}\x1b[0m\n`);
  process.exit(1);
}

loadEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  fail("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.local");
}
if (!/^https:\/\/.+\.supabase\.co\/?$/.test(url)) {
  console.log(`\x1b[33m⚠ SUPABASE_URL no parece una URL de Supabase.\x1b[0m`);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const hold = (start, hours = 2) =>
  db.rpc("create_hold", {
    p_space: "karaoke",
    p_date: TEST_DATE,
    p_start: start,
    p_hours: hours,
    p_extras: [],
    p_amount: 1,
    p_name: CHECK_TAG,
    p_phone: "0000000",
    p_email: "check@example.com",
    p_hold_minutes: 5,
  });

const cleanup = () => db.from("reservations").delete().eq("customer_name", CHECK_TAG);

console.log("\nVerificando Supabase…\n");
let failures = 0;

// 1) Conexión + tabla + service key válida
{
  const { error } = await db.from("reservations").select("id").limit(1);
  if (error) {
    bad(`No se pudo leer la tabla reservations: ${error.message}`);
    fail("¿Corriste supabase/schema.sql en el SQL editor? ¿La clave es la service_role?");
  }
  ok("Conexión y tabla reservations");
}

// 2) Función de disponibilidad
{
  const { error } = await db.rpc("taken_ranges", { p_space: "karaoke", p_date: TEST_DATE });
  if (error) {
    bad(`Falta la función taken_ranges: ${error.message}`);
    failures++;
  } else ok("Función taken_ranges");
}

// 3) La prueba que de verdad importa: no se puede vender dos veces el mismo cupo
await cleanup();
{
  const { error: e1 } = await hold("17:00");
  if (e1) {
    bad(`create_hold falló: ${e1.message}`);
    failures++;
  } else {
    ok("create_hold crea una reserva");

    // Mismo horario exacto → debe rebotar
    const { error: e2 } = await hold("17:00");
    if (e2 && e2.message.includes("SLOT_TAKEN")) ok("Rechaza el mismo horario (SLOT_TAKEN)");
    else {
      bad("¡PERMITIÓ DOBLE RESERVA en el mismo horario! Falta la restricción de exclusión.");
      failures++;
    }

    // Solapamiento parcial (17:00–19:00 + buffer llega hasta 19:30)
    const { error: e3 } = await hold("18:00");
    if (e3 && e3.message.includes("SLOT_TAKEN")) ok("Rechaza un horario solapado");
    else {
      bad("¡PERMITIÓ una reserva solapada!");
      failures++;
    }

    // 19:00 cae dentro del buffer de 30 min → debe rebotar
    const { error: e4 } = await hold("19:00");
    if (e4 && e4.message.includes("SLOT_TAKEN")) ok("Respeta el buffer de 30 min");
    else {
      bad("Aceptó una reserva sin respetar el buffer de 30 min.");
      failures++;
    }

    // 20:00 deja 60 min de separación → debe pasar
    const { error: e5 } = await hold("20:00");
    if (!e5) ok("Acepta un horario libre (20:00)");
    else {
      bad(`Rechazó un horario que debería estar libre: ${e5.message}`);
      failures++;
    }
  }
}

await cleanup();
ok("Reservas de prueba eliminadas");

if (failures) {
  fail(`${failures} comprobación(es) fallaron. Revisa supabase/schema.sql.`);
}
console.log("\n\x1b[32mTodo correcto. Supabase está listo.\x1b[0m\n");
