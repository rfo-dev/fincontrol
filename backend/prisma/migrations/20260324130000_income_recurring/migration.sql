-- AlterTable
ALTER TABLE "incomes" ADD COLUMN "is_recurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "incomes" ADD COLUMN "recurring_interval" TEXT;
ALTER TABLE "incomes" ADD COLUMN "recurring_count" INTEGER;
