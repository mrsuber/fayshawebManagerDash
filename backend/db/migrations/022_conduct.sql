-- House rules are watched by the team, not shown to the guest. A request to add someone overnight beyond the residence's
-- capacity is no longer refused in the app: it waits for a manager with the reason here (only staff see it).
ALTER TABLE stay_guests ADD COLUMN IF NOT EXISTS flag VARCHAR(255);

-- Guest conduct: what the team recorded about a guest (visitors after hours, overcrowding, damage, children left alone…),
-- and a block on future bookings for a guest who keeps breaking the house rules they accepted.
CREATE TABLE IF NOT EXISTS guest_incidents (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('visitors', 'overcrowding', 'noise', 'damage', 'children', 'smoking', 'conduct', 'other')),
  severity VARCHAR(10) NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'serious')),
  note TEXT NOT NULL,
  charge NUMERIC(12, 2),                      -- what was charged for it, if anything (also on the folio)
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guest_incidents_guest ON guest_incidents(guest_id, created_at DESC);

-- A guest flagged for breaking the house rules: their bookings are either held for Faysha to accept or decline
-- ('review', the default) or declined automatically ('decline'). Matched on the account, its email or its phone.
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_restriction VARCHAR(10) CHECK (booking_restriction IN ('review', 'decline'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_restricted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_restriction_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_restricted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_booking_restriction ON users(LOWER(email)) WHERE booking_restriction IS NOT NULL;

-- A booking request from a flagged guest: no payment is taken, the dates are held (the hold never expires on its own)
-- until a manager accepts (confirmed, paid on the bill) or declines it.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS review_status VARCHAR(10) CHECK (review_status IN ('pending', 'accepted', 'declined'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_bookings_review ON bookings(review_status) WHERE review_status = 'pending';

-- Terms of Service: the guest answers for their children, their visitors and any damage, and repeated breaches can end
-- the stay and future bookings. Published as a new version (new bookings record it) unless the text already says so.
DO $$
DECLARE
  clause TEXT := $md$### 6.3 Children, visitors and damage

- Children are the responsibility of the guest who booked at all times, inside the residence and on the estate; they must not be left alone in the residence or in common areas
- The booking guest is responsible for their visitors and overnight guests: their behaviour, respect of the house rules and any damage they cause
- Visitors are welcome within visiting hours and the limits of our visitor policy; anyone staying the night must be registered on the stay, within the residence's maximum occupancy
- Damage to the residence, its furniture, equipment or the estate caused by the guest, their children or their visitors is charged to the guest at the cost of repair or replacement

### 6.4 Breaches of the house rules

- Our team may record breaches of these Terms and the house rules (for example visitors after hours, more people than the residence sleeps, noise, damage or children left unsupervised)
- A serious or repeated breach may end the stay without refund of the remaining nights
- Faysha may decline future bookings from a guest who has seriously or repeatedly breached these Terms

$md$;
  body TEXT;
  v INTEGER;
BEGIN
  SELECT version INTO v FROM legal_documents WHERE slug = 'terms';
  IF v IS NULL THEN RETURN; END IF;
  SELECT lv.body INTO body FROM legal_document_versions lv WHERE lv.slug = 'terms' AND lv.version = v;
  IF body IS NULL THEN body := (SELECT draft FROM legal_documents WHERE slug = 'terms'); END IF;
  IF body ILIKE '%Children, visitors and damage%' THEN RETURN; END IF;
  body := CASE WHEN position(E'\n## 7.' IN body) > 0
               THEN overlay(body PLACING clause || '## 7.' FROM position(E'\n## 7.' IN body) + 1 FOR 5)
               ELSE body || E'\n\n' || clause END;
  -- "## 7." (5 characters after the newline) becomes the clause followed by "## 7.".
  IF v > 0 THEN
    INSERT INTO legal_document_versions (slug, version, title, body, summary, effective_date)
    SELECT 'terms', v + 1, title, body, 'Children, visitors and damage are the guest''s responsibility; repeated breaches may end the stay and future bookings', CURRENT_DATE
      FROM legal_documents WHERE slug = 'terms';
    UPDATE legal_documents SET version = v + 1, draft = body, updated_at = NOW() WHERE slug = 'terms';
  ELSE
    UPDATE legal_documents SET draft = body, updated_at = NOW() WHERE slug = 'terms';
  END IF;
END $$;
