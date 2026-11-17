-- AlterTable: content status for each Model Assign row.
ALTER TABLE "Assignment" ADD COLUMN "contentDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "contentDoneAt" TIMESTAMP(3),
ADD COLUMN "contentDoneById" TEXT;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_contentDoneById_fkey" FOREIGN KEY ("contentDoneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
