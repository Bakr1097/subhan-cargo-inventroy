-- Step 1: Drop the global unique constraint on bilty_number
ALTER TABLE "parcels" DROP CONSTRAINT "parcels_bilty_number_unique";
--> statement-breakpoint
-- Step 2: Bilty numbers are only unique among parcels currently IN_STORE.
-- Released and voided parcels free the number for reuse.
CREATE UNIQUE INDEX "parcels_bilty_active_unique" ON "parcels" ("bilty_number") WHERE status = 'IN_STORE';
