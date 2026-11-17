-- The No Measurement size tag and text were stored inside the qualityChecks
-- JSON, which made them show up as quality checks. Move them to their own
-- columns (keeping any saved values), then remove them from qualityChecks.

-- AlterTable
ALTER TABLE "MeasurementTemplate" ADD COLUMN "noMeasurementFieldId" TEXT,
ADD COLUMN "noMeasurementText" TEXT;

UPDATE "MeasurementTemplate"
SET "noMeasurementFieldId" = NULLIF("qualityChecks"->>'noMeasurementFieldId', ''),
    "noMeasurementText" = NULLIF("qualityChecks"->>'noMeasurementText', '')
WHERE jsonb_typeof("qualityChecks") = 'object';

UPDATE "MeasurementTemplate"
SET "qualityChecks" = "qualityChecks" - 'noMeasurementFieldId' - 'noMeasurementText'
WHERE jsonb_typeof("qualityChecks") = 'object'
  AND ("qualityChecks" ? 'noMeasurementFieldId' OR "qualityChecks" ? 'noMeasurementText');
