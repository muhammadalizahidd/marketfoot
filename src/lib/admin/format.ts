const pad = (value: number) => String(value).padStart(2, "0");
const parts = (value: string | Date) => {
  const date = new Date(value);
  const paris = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => paris.find((part) => part.type === type)?.value ?? "";
  return { day: get("day"), month: get("month"), year: get("year"), hour: get("hour"), minute: get("minute") };
};

/** 01/08/2025 (Europe/Paris) */
export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const p = parts(value);
  return `${p.day}/${p.month}/${p.year}`;
}
/** 02/11/26 - 20:45 (Europe/Paris) */
export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const p = parts(value);
  return `${p.day}/${p.month}/${p.year.slice(2)} - ${p.hour}:${p.minute}`;
}
/** Value for `<input type="date">` / `<input type="time">` in Europe/Paris. */
export function toDateInput(value?: string | Date | null): string {
  if (!value) return "";
  const p = parts(value);
  return `${p.year}-${p.month}-${p.day}`;
}
export function toTimeInput(value?: string | Date | null): string {
  if (!value) return "";
  const p = parts(value);
  return `${p.hour}:${p.minute}`;
}
/** Combines Europe/Paris wall-clock date + time into an ISO instant (handles DST by probing the offset). */
export function parisToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const guess = new Date(`${date}T${time}:00Z`);
  const shown = parts(guess);
  const asUtc = Date.UTC(Number(shown.year), Number(shown.month) - 1, Number(shown.day), Number(shown.hour), Number(shown.minute));
  const offset = asUtc - guess.getTime();
  const result = new Date(guess.getTime() - offset);
  return Number.isNaN(result.getTime()) ? null : result.toISOString();
}

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const formatEuro = (value: number) => euro.format(value);
/** 14,56 M€ / 750 k€ */
export function formatCompactEuro(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M€`;
  if (abs >= 1_000) return `${Math.round(value / 1_000).toLocaleString("fr-FR")} k€`;
  return `${value.toLocaleString("fr-FR")} €`;
}
export const signed = (value: number, text: string) => (value > 0 ? `+${text}` : text);
export { pad };
