-- AlterTable: new optional SP value on products.
ALTER TABLE "Product" ADD COLUMN "sp" TEXT;

-- Measurement values become text so they can hold ranges like "34-38".
-- Existing numbers are kept, written without trailing zeros:
-- 38.00 -> "38", 12.50 -> "12.5", 22.25 -> "22.25".
ALTER TABLE "MeasurementValue"
  ALTER COLUMN "value" TYPE TEXT
  USING regexp_replace(
    regexp_replace("value"::text, '(\.\d*?)0+$', '\1'),
    '\.$',
    ''
  );
