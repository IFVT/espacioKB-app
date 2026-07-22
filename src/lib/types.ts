import type { SpaceId } from "../data/spaces";

export interface Customer {
  name: string;
  phone: string;
  email: string;
}

export interface Reservation {
  spaceId: SpaceId | null;
  hours: number;
  date: string | null; // "YYYY-MM-DD"
  startTime: string | null; // "HH:00"
  extras: string[]; // ids de equipos seleccionados
  customer: Customer;
}
