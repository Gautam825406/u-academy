-- Fee receipt numbers: make them collision-safe (Nov 2026 audit).
--
-- The dashboard used to number manual receipts from the row COUNT
-- (U++-2026-<count+1>), so deleting any fee row made the next receipt
-- collide with a live one. The dashboard now derives the next number
-- from the MAX existing manual receipt suffix and retries once on a
-- unique violation (code 23505). This constraint is the database-level
-- backstop for that retry logic.
--
-- Idempotent: safe to run more than once. If it fails with a duplicate-key
-- error, duplicate receipt_no values already exist in fees — dedupe those
-- rows first (re-number the duplicates), then re-run this file.
-- NOTE: run this in the Supabase SQL Editor. It was NOT run by the agent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fees_receipt_no_unique'
      AND conrelid = 'public.fees'::regclass
  ) THEN
    ALTER TABLE public.fees
      ADD CONSTRAINT fees_receipt_no_unique UNIQUE (receipt_no);
  END IF;
END $$;
