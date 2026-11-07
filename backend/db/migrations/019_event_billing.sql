-- Events: quote first (no budget asked up front), with mood images; a client who finds it too much gives their
-- budget and gets a revised proposal. Accepting issues an invoice; every payment — online or recorded by the team —
-- gets an official receipt, so all money for an event goes through the platform and is on record.
ALTER TABLE event_quotes ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]';   -- [{ url, caption }]
ALTER TABLE event_quotes ADD COLUMN IF NOT EXISTS counter_budget NUMERIC(14, 2);         -- what the client said they can spend
ALTER TABLE event_quotes ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(40) UNIQUE;
ALTER TABLE event_quotes ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS client_budget NUMERIC(14, 2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(40) UNIQUE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE SEQUENCE IF NOT EXISTS event_invoice_seq;
CREATE SEQUENCE IF NOT EXISTS payment_receipt_seq;

-- The quote status 'declined' now also covers "too much: here is my budget" (counter_budget set).
