/** `datetime-local` string ↔ ms for workshop session admin forms. */

export function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseLocalInput(s: string): number {
  const t = Date.parse(s);
  if (Number.isNaN(t)) {
    throw new Error("Invalid date/time");
  }
  return t;
}
