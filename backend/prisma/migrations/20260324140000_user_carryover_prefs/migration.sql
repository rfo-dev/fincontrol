-- AlterTable
ALTER TABLE "users" ADD COLUMN "bring_previous_expenses" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "bring_previous_incomes" BOOLEAN NOT NULL DEFAULT false;
