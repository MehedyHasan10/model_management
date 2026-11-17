/** "1 field", "9 fields", "1 piece", "3 pieces". Pass `many` for irregular words. */
export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Text shown for an empty value. */
export const EMPTY = "-";

/** Today's date in the browser's time zone as YYYY-MM-DD (not UTC). */
export function localDateInput(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
