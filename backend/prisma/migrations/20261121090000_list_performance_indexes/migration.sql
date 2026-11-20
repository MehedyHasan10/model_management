-- Foreign keys used by the product and assignment lists had no index.
CREATE INDEX IF NOT EXISTS "Product_createdAt_id_idx" ON "Product"("createdAt", "id");
CREATE INDEX IF NOT EXISTS "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX IF NOT EXISTS "Assignment_createdAt_id_idx" ON "Assignment"("createdAt", "id");
CREATE INDEX IF NOT EXISTS "Assignment_modelId_idx" ON "Assignment"("modelId");
CREATE INDEX IF NOT EXISTS "AssignmentItem_assignmentId_idx" ON "AssignmentItem"("assignmentId");
CREATE INDEX IF NOT EXISTS "ReturnTransaction_assignmentId_idx" ON "ReturnTransaction"("assignmentId");
CREATE INDEX IF NOT EXISTS "ReturnItem_transactionId_idx" ON "ReturnItem"("transactionId");
CREATE INDEX IF NOT EXISTS "ReturnItem_assignmentItemId_idx" ON "ReturnItem"("assignmentItemId");
