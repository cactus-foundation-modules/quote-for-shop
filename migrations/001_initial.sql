-- Quote for Shop - initial schema (prefix qfs_).
-- All DDL idempotent, so it is safe to re-run on every deploy.
--
-- Column types stay inside the backup serialiser's supported set
-- (lib/backup/serialize.ts): TEXT, INTEGER, NUMERIC, BOOLEAN, JSONB, TIMESTAMP.
-- No enums and no arrays: `kind` and `status` are plain TEXT with a CHECK, which
-- dumps and restores as a string like any other, and the two list-shaped columns
-- are JSONB.
--
-- Two tables and one sequence. The sequence is the quote's human number, and it
-- is the reason this module's schema needs a real backup round-trip rather than
-- a glance: a restored shop whose qfs_quote_number_seq went back to 1 would
-- start handing out quote numbers it has already used, and the UNIQUE below
-- would then refuse the next quote outright. Core dumps sequences separately
-- from tables (information_schema.tables never sees them) - see
-- lib/backup/serialize.ts.

-- Singleton settings row. One JSONB blob, parsed through a zod schema with
-- defaults on read (lib/config.ts), so a column added in a later version needs
-- no migration and a half-written blob falls back to defaults rather than
-- taking the storefront down. Same shape as shp_settings.
CREATE TABLE IF NOT EXISTS "qfs_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qfs_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "qfs_settings" ("id", "config") VALUES ('singleton', '{}'::jsonb)
ON CONFLICT ("id") DO NOTHING;

-- Human-facing quote number, atomic under concurrent saves for the same reason
-- shp_order_number_seq is: two shoppers pressing "save my cart" in the same
-- instant must not be handed the same number.
CREATE SEQUENCE IF NOT EXISTS "qfs_quote_number_seq" START WITH 1000 INCREMENT BY 1;

-- One saved or requested quote.
--
-- `lines` and `totals` are a PRICED SNAPSHOT taken when the quote was made: what
-- each thing was called, its SKU, its quantity and what it cost that day. They
-- are what the document prints and what the PDF is generated from, and they are
-- deliberately not recomputed on read - a quote that silently reprices itself is
-- not a quote. `cart` is the raw cart (product ids, quantities, per-line meta) so
-- retrieving a quote can put the shopper's basket back exactly as it was; the
-- retrieve endpoint reprices THAT through the shop's own resolver and reports
-- what has moved, rather than trusting either copy blindly.
CREATE TABLE IF NOT EXISTS "qfs_quotes" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "quote_number" TEXT NOT NULL,
    -- The short code a shopper types in to get their cart back. Uppercase, no
    -- ambiguous characters (see lib/code.ts) - it gets read off a phone screen
    -- and dictated over the telephone, so 0/O and 1/I/L are not in the alphabet.
    "code" TEXT NOT NULL,
    -- 'SAVED' - the shopper parked their own cart. 'REQUEST' - they asked for a
    -- price. The difference matters to the owner (one is a lead, the other is a
    -- shopper being tidy), so it is recorded rather than inferred from whether a
    -- name happens to be filled in.
    "kind" TEXT NOT NULL DEFAULT 'SAVED',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "customer_name" TEXT NOT NULL DEFAULT '',
    "customer_email" TEXT NOT NULL DEFAULT '',
    "customer_phone" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    -- What the shopper wrote when they asked.
    "message" TEXT NOT NULL DEFAULT '',
    -- What the owner wrote back, and what only the owner sees.
    "reply" TEXT NOT NULL DEFAULT '',
    "staff_notes" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "currency_symbol" TEXT NOT NULL DEFAULT '£',
    "lines" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "totals" JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- The raw cart (product ids, quantities, per-line meta) as the shopper's
    -- browser held it, so retrieving a quote puts the basket back exactly as it
    -- was rather than approximately. Kept apart from `lines` because that one is
    -- a printed record and this one is machine input.
    "cart" JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Whether the shop was withholding prices when this was made. Kept on the
    -- row rather than read from settings at print time, so a document printed
    -- today still reads the way the shopper saw it, even after the owner has
    -- changed their mind about showing prices.
    "prices_hidden" BOOLEAN NOT NULL DEFAULT false,
    -- Core Member id when the shopper was signed in, so their account can list
    -- their own quotes. Deliberately no foreign key: a quote outliving the
    -- account that made it is a record the owner still wants.
    "member_id" TEXT,
    "source_url" TEXT NOT NULL DEFAULT '',
    "expires_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    -- Set when the owner turns the quote into a real order (shp_orders.id). Also
    -- no foreign key: shop owns that table, and this module must never be the
    -- reason a shop cannot delete an order.
    "converted_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qfs_quotes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "qfs_quotes_code_key" UNIQUE ("code"),
    CONSTRAINT "qfs_quotes_quote_number_key" UNIQUE ("quote_number"),
    CONSTRAINT "qfs_quotes_kind_check" CHECK ("kind" IN ('SAVED', 'REQUEST')),
    CONSTRAINT "qfs_quotes_status_check" CHECK ("status" IN ('NEW', 'SENT', 'WON', 'LOST', 'EXPIRED'))
);

-- The admin list sorts newest first and filters by status; the storefront looks
-- a quote up by its code, which the UNIQUE above already indexes.
CREATE INDEX IF NOT EXISTS "qfs_quotes_created_at_idx" ON "qfs_quotes" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "qfs_quotes_status_idx" ON "qfs_quotes" ("status");
CREATE INDEX IF NOT EXISTS "qfs_quotes_customer_email_idx" ON "qfs_quotes" ("customer_email");
CREATE INDEX IF NOT EXISTS "qfs_quotes_member_id_idx" ON "qfs_quotes" ("member_id");
