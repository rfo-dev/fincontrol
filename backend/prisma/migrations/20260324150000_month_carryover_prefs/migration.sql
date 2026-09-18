-- AlterTable
ALTER TABLE "users" ADD COLUMN "month_carryover_prefs" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "users" DROP COLUMN IF EXISTS "bring_previous_expenses";
ALTER TABLE "users" DROP COLUMN IF EXISTS "bring_previous_incomes";
