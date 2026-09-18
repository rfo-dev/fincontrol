-- AlterTable
ALTER TABLE "incomes" ADD COLUMN "recurring_index" INTEGER;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN "recurring_index" INTEGER;

-- Backfill existing recurring incomes by series (description + interval)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, description, COALESCE(recurring_interval, '')
      ORDER BY date ASC, created_at ASC
    ) AS idx,
    COUNT(*) OVER (
      PARTITION BY user_id, description, COALESCE(recurring_interval, '')
    ) AS total
  FROM incomes
  WHERE is_recurring = true
)
UPDATE incomes i
SET
  recurring_index = ranked.idx,
  recurring_count = COALESCE(i.recurring_count, ranked.total)
FROM ranked
WHERE i.id = ranked.id
  AND ranked.total > 1;

-- Backfill existing recurring expenses by series
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, description, COALESCE(recurring_interval, ''), COALESCE(credit_card_id::text, '')
      ORDER BY date ASC, created_at ASC
    ) AS idx,
    COUNT(*) OVER (
      PARTITION BY user_id, description, COALESCE(recurring_interval, ''), COALESCE(credit_card_id::text, '')
    ) AS total
  FROM expenses
  WHERE is_recurring = true
)
UPDATE expenses e
SET
  recurring_index = ranked.idx,
  recurring_count = COALESCE(e.recurring_count, ranked.total)
FROM ranked
WHERE e.id = ranked.id
  AND ranked.total > 1;
