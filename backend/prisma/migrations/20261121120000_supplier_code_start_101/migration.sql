-- New supplier product codes start at 101 instead of 1001.
ALTER TABLE "SupplierProductSequence" ALTER COLUMN "nextNumber" SET DEFAULT 101;
