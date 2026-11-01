/**
 * Asset lifecycle figures, computed in SQL so the register, the budget and the monitor agree.
 *
 *   age_months        months since purchase
 *   life_left_months  expected life − age (negative: past its expected life)
 *   replace_by        purchase date + expected life
 *   order_by          replace_by − supplier lead time − 30 days of margin
 *   reserve_balance   contributions − spending so far
 *   monthly_reserve   the override, else (replacement cost − balance) ÷ months left (at least 1)
 *   funded_pct        balance ÷ replacement cost
 */
const db = require('../config/database');

const TZ = process.env.PROPERTY_TZ || 'Africa/Douala';

const ASSET_SQL = `
  WITH r AS (SELECT asset_id, SUM(CASE WHEN kind = 'spend' THEN -amount ELSE amount END) AS balance FROM asset_reserve GROUP BY asset_id),
  today AS (SELECT (NOW() AT TIME ZONE '${TZ}')::date AS d),
  base AS (
    SELECT a.*, ap.unit_number, COALESCE(r.balance, 0) AS reserve_balance,
           CASE WHEN a.purchase_date IS NULL THEN NULL
                ELSE (EXTRACT(YEAR FROM age(today.d, a.purchase_date)) * 12 + EXTRACT(MONTH FROM age(today.d, a.purchase_date)))::int END AS age_months,
           CASE WHEN a.purchase_date IS NULL OR a.expected_life_months IS NULL THEN NULL
                ELSE (a.purchase_date + make_interval(months => a.expected_life_months))::date END AS replace_by,
           today.d AS today
      FROM assets a CROSS JOIN today
      LEFT JOIN r ON r.asset_id = a.id
      LEFT JOIN apartments ap ON ap.id = a.apartment_id
  )
  SELECT base.*,
         expected_life_months - age_months AS life_left_months,
         (replace_by - make_interval(days => lead_time_days + 30))::date AS order_by,
         COALESCE(reserve_override,
                  CASE WHEN replacement_cost IS NULL OR expected_life_months IS NULL THEN 0
                       ELSE GREATEST(0, (replacement_cost - reserve_balance) / GREATEST(1, COALESCE(expected_life_months - age_months, expected_life_months))) END) AS monthly_reserve,
         CASE WHEN replacement_cost > 0 THEN LEAST(100, ROUND(reserve_balance * 100 / replacement_cost)) ELSE NULL END AS funded_pct,
         (SELECT MIN(next_due) FROM asset_tasks t WHERE t.asset_id = base.id AND t.active) AS next_task_due
    FROM base`;

const num = (v) => (v === null || v === undefined ? null : Number(v));
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

function toAsset(r) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    category: r.category,
    apartmentId: r.apartment_id,
    residence: r.unit_number || null,
    location: r.location,
    criticality: r.criticality,
    status: r.status,
    brand: r.brand,
    model: r.model,
    serial: r.serial,
    supplier: r.supplier,
    supplierContact: r.supplier_contact,
    purchaseDate: day(r.purchase_date),
    purchaseCost: num(r.purchase_cost),
    currency: r.currency,
    warrantyUntil: day(r.warranty_until),
    expectedLifeMonths: r.expected_life_months,
    replacementCost: num(r.replacement_cost),
    leadTimeDays: r.lead_time_days,
    reserveOverride: num(r.reserve_override),
    sparesMin: r.spares_min,
    sparesOnHand: r.spares_on_hand,
    photo: r.photo_url,
    notes: r.notes,
    ageMonths: r.age_months,
    lifeLeftMonths: r.life_left_months,
    replaceBy: day(r.replace_by),
    orderBy: day(r.order_by),
    reserveBalance: Number(r.reserve_balance || 0),
    monthlyReserve: Math.round(Number(r.monthly_reserve || 0)),
    fundedPct: r.funded_pct === null ? null : Number(r.funded_pct),
    nextTaskDue: day(r.next_task_due),
    // What to look at: replacement due to be ordered, spares below minimum, warranty ending, out of service.
    flags: [
      r.status === 'out_of_service' && 'out_of_service',
      r.status === 'needs_attention' && 'needs_attention',
      r.order_by && day(r.order_by) <= day(new Date(Date.now() + 30 * 864e5)) && r.status !== 'retired' && 'order_soon',
      r.spares_on_hand < r.spares_min && 'spares_low',
      r.warranty_until && day(r.warranty_until) >= day(r.today) && day(r.warranty_until) <= day(new Date(Date.now() + 30 * 864e5)) && 'warranty_ending',
    ].filter(Boolean),
  };
}

/** Posts this month's contribution for every asset in service, once (unique per asset and month). */
async function postMonthlyReserve() {
  const { rowCount } = await db.query(
    `INSERT INTO asset_reserve (asset_id, month, kind, amount, note)
     SELECT id, date_trunc('month', (NOW() AT TIME ZONE $1))::date, 'contribution', ROUND(monthly_reserve), 'Monthly contribution'
       FROM (${ASSET_SQL}) x
      WHERE status <> 'retired' AND monthly_reserve > 0
     ON CONFLICT (asset_id, month) WHERE kind = 'contribution' DO NOTHING`,
    [TZ],
  );
  return rowCount;
}

/** Next due date after `from` for a task repeating every n units. */
const nextDueSql = `($1::date + CASE $3 WHEN 'day' THEN make_interval(days => $2) WHEN 'week' THEN make_interval(weeks => $2) WHEN 'year' THEN make_interval(years => $2) ELSE make_interval(months => $2) END)::date`;

module.exports = { ASSET_SQL, toAsset, postMonthlyReserve, nextDueSql };
