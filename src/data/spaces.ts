// Datos oficiales de Espacio KB. NO inventar precios: son exactamente los del
// documento de handoff. Todos los valores en COP.

export type SpaceId = "karaoke" | "casita";

export interface Extra {
  id: string;
  name: string;
  price: number;
  /** true = el precio se multiplica por las horas; false = precio único. */
  perHour: boolean;
  /** Ruta de la foto del equipo en /public (opcional). */
  image?: string;
}

export interface Space {
  id: SpaceId;
  name: string;
  tagline: string;
  capacity: number;
  /** Tarifa de sala por número de horas (2..7). */
  hourly: Record<number, number>;
  extras: Extra[];
  /** La tarifa base ya incluye conectar el celular al sistema de audio. */
  includesPhone: boolean;
  /** Ruta de la foto de la sala en /public. */
  image: string;
}

export const SPACES: Record<SpaceId, Space> = {
  karaoke: {
    id: "karaoke",
    name: "Karaoke",
    tagline: "Capacidad hasta 28 personas",
    capacity: 28,
    hourly: { 2: 180000, 3: 270000, 4: 360000, 5: 450000, 6: 540000, 7: 630000 },
    extras: [],
    includesPhone: true,
    image: "/img/karaoke.jpg",
  },
  casita: {
    id: "casita",
    name: "La Casita de Renata",
    tagline: "Mini audio room · hasta 15 personas",
    capacity: 15,
    hourly: { 2: 220000, 3: 330000, 4: 440000, 5: 550000, 6: 660000, 7: 770000 },
    // La tarifa base YA incluye conectar el celular al sistema de audio.
    extras: [
      {
        id: "tornamesas",
        name: "2 Tornamesas Technics 1200 + Mixer Pioneer 320 (no incluye agujas)",
        price: 500000,
        perHour: false,
        image: "/img/extra-tornamesas.jpg",
      },
      {
        id: "rx3",
        name: "Controlador Pioneer RX3",
        price: 450000,
        perHour: false,
        image: "/img/extra-rx3.jpg",
      },
      {
        id: "cdj",
        name: "2 CDJ Pioneer 3000 + Mixer Pioneer 900",
        price: 600000,
        perHour: false,
        image: "/img/extra-cdj.jpg",
      },
    ],
    includesPhone: true,
    image: "/img/casita.jpg",
  },
};

// Consumo mínimo: se PAGA EN EL SITIO (no en línea). Solo se muestra como aviso.
export const MIN_CONSUMO = (hours: number): number => (hours >= 4 ? 400000 : 200000);

// Reglas de agenda (defaults POR CONFIRMAR con la dueña — ver sección 7 del doc).
export const SCHEDULE = {
  timezone: "America/Bogota",
  days: [4, 5, 6, 0], // jueves, viernes, sábado, domingo (0=dom … 6=sáb)
  openHour: 17, // 5 p.m.
  closeHour: 24, // medianoche
  slotStepMinutes: 60, // reservas empiezan en hora en punto
  bufferMinutes: 30, // separación entre reservas
  minLeadHours: 24, // anticipación mínima
  maxAdvanceDays: 90, // hasta 3 meses
  minHours: 2,
  maxHours: 7,
} as const;

export const HOURS_OPTIONS: number[] = [2, 3, 4, 5, 6, 7];

// Políticas oficiales a mostrar (sección 12 del doc).
export const POLICIES: string[] = [
  "Consumo mínimo en el bar (se paga en el lugar, no en línea).",
  "Reprogramación solo con 5+ días de anticipación; al reprogramar no se cobra el consumo mínimo.",
  "Sin devoluciones por cancelación o inasistencia.",
  "No se admiten bebidas externas.",
  "Puedes llevar decoraciones de cumpleaños.",
  "KB se reserva el derecho de admisión.",
  "KB no responde por situaciones ajenas a su voluntad.",
];
