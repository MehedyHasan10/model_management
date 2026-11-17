-- Measurement units become their own table. Existing field units are moved
-- to the matching unit row before the old text column is dropped.

-- CreateTable
CREATE TABLE "MeasurementUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementUnit_pkey" PRIMARY KEY ("id")
);

-- Case-insensitive uniqueness for unit name and symbol.
CREATE UNIQUE INDEX "MeasurementUnit_name_lower_key" ON "MeasurementUnit"(LOWER("name"));
CREATE UNIQUE INDEX "MeasurementUnit_symbol_lower_key" ON "MeasurementUnit"(LOWER("symbol"));

-- Default units. Inches is created first so it is listed (and preselected) first.
INSERT INTO "MeasurementUnit" ("id", "name", "symbol", "createdAt", "updatedAt") VALUES
    ('unit_inches', 'Inches', 'in', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_centimeters', 'Centimeters', 'cm', CURRENT_TIMESTAMP + INTERVAL '1 second', CURRENT_TIMESTAMP);

-- Keep any other unit text already in use, so no field loses its unit.
INSERT INTO "MeasurementUnit" ("id", "name", "symbol", "updatedAt")
SELECT 'unit_' || md5(s.symbol), s.symbol, s.symbol, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (LOWER(TRIM("unit"))) TRIM("unit") AS symbol
    FROM "MeasurementField"
    WHERE TRIM(COALESCE("unit", '')) <> ''
      AND LOWER(TRIM("unit")) NOT IN ('in', 'cm')
    ORDER BY LOWER(TRIM("unit")), TRIM("unit")
) s;

-- AlterTable: add the relation column, fill it, then make it required.
ALTER TABLE "MeasurementField" ADD COLUMN "unitId" TEXT;

UPDATE "MeasurementField" f
SET "unitId" = u."id"
FROM "MeasurementUnit" u
WHERE LOWER(u."symbol") = LOWER(TRIM(f."unit"));

UPDATE "MeasurementField" SET "unitId" = 'unit_inches' WHERE "unitId" IS NULL;

ALTER TABLE "MeasurementField" ALTER COLUMN "unitId" SET NOT NULL;

-- Only now remove the old text column.
ALTER TABLE "MeasurementField" DROP COLUMN "unit";

-- CreateIndex
CREATE INDEX "MeasurementField_unitId_idx" ON "MeasurementField"("unitId");

-- AddForeignKey
ALTER TABLE "MeasurementField" ADD CONSTRAINT "MeasurementField_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "MeasurementUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
