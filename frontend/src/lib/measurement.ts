// Measurement values are text: a single number (38, 38.5) or a range where
// the first number is smaller (34-38, 34.5-36). The server checks the same rules.
export const MEASUREMENT_VALUE_PATTERN =
  /^\d{1,3}(\.\d{1,2})?(-\d{1,3}(\.\d{1,2})?)?$/;
export const MEASUREMENT_VALUE_MESSAGE = "Use a number or a range like 34-38";

/** Trims spaces and turns long dashes into "-": " 34 - 38 " becomes "34-38". */
export function normalizeMeasurementValue(raw: string) {
  return raw
    .replace(/[\u2012-\u2015\u2212]/g, "-")
    .trim()
    .replace(/\s*-\s*/g, "-");
}

export function isValidMeasurementValue(value: string) {
  if (!MEASUREMENT_VALUE_PATTERN.test(value)) return false;
  const [from, to] = value.split("-");
  return to === undefined || Number(from) < Number(to);
}

/** Values arrive as text (or numbers from older API responses); show them as saved. */
export const measurementText = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();
