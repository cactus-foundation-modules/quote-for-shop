-- Which order a quote's agreed prices were spent on, and when.
--
-- A quote's link puts its lines in the customer's basket at the prices the owner
-- agreed (custom variations, hand-priced lines, fixed charges). Those prices are
-- good for ONE order: once an order has been placed from the quote, the link
-- stops honouring them, so the same deal cannot be bought twice by accident or
-- by a forwarded email. The owner renews a quote by clearing these two again,
-- from the quote's own page.
--
-- Separate from "converted_order_id", which records the order staff made FROM
-- the quote by hand and is a permanent link; a renewal must not forget that.
--
-- Idempotent, so an existing install picks it up on its next update.
ALTER TABLE "qfs_quotes" ADD COLUMN IF NOT EXISTS "prices_used_order_id" TEXT;
ALTER TABLE "qfs_quotes" ADD COLUMN IF NOT EXISTS "prices_used_at" TIMESTAMP(3);
