/**
 * Base data every installation needs. Inserted only where missing (by natural key), so running setup again
 * never duplicates rows or overwrites what staff have changed since.
 */

const ROLES = [
  {
    name: 'superadmin',
    display_name: 'Super Administrator',
    description: 'Full access to Faysha HQ and FAY OS, including roles, finance and approvals.',
    system: true,
    permissions: {},
  },
  {
    name: 'manager',
    display_name: 'Manager',
    description: 'Runs the property in FAY OS: reservations, guests, residences and operations. Also sees HR.',
    system: true,
    permissions: {
      reservations: { view: true, create: true, edit: true, delete: true, manage: true },
      bookings: { view: true, create: true, edit: true, delete: true, manage: true },
      guests: { view: true, create: true, edit: true, manage: true },
      residences: { view: true, create: true, edit: true },
      concierge: { view: true, respond: true, manage: true },
      wellness: { view: true, manage: true },
      housekeeping: { view: true, assign: true, manage: true },
      maintenance: { view: true, assign: true, manage: true },
      dining: { view: true, manage: true },
      transportation: { view: true, manage: true },
      experiences: { view: true, manage: true },
      analytics: { view: true },
    },
  },
  {
    name: 'staff',
    display_name: 'Staff',
    description: 'Operations team (housekeeping, maintenance, dining, wellness, transport).',
    system: true,
    permissions: { operations: { view: true } },
  },
  {
    name: 'hr_manager',
    display_name: 'HR Manager',
    description: 'People team: employees, recruitment, attendance and leave. Sees only the HR section of HQ.',
    system: true,
    permissions: { hr: { view: true, manage: true, approve: true } },
  },
  {
    name: 'content_manager',
    display_name: 'Content Manager',
    description: 'Edits and publishes the website copy.',
    system: true,
    permissions: { website: { view: true, manage: true } },
  },
  {
    name: 'guest',
    display_name: 'Guest',
    description: 'A guest: books stays on the website and uses the Faysha app.',
    system: true,
    permissions: { bookings: { view: true, edit: true }, wellness: { view: true, book: true } },
  },
];

const SETTINGS = {
  property: {
    name: 'Faysha Wellness Residence',
    brand: 'FAY OS',
    timeZone: 'West Africa Time (GMT+1)',
    currency: 'XAF',
    checkInTime: '3:00 PM',
    checkOutTime: '11:00 AM',
    phone: '',
    email: 'concierge@fayshaa.com',
  },
  preferences: {
    ai: { autoReply: true, recommendations: true, autoAssign: false, smartHome: true, approvalOver500: true },
    notifications: {
      vipArrival: { push: true, email: true, sms: false },
      escalation: { push: true, email: true, sms: false },
      newRequest: { push: true, email: false, sms: false },
      payment: { push: false, email: true, sms: false },
      deviceAlert: { push: true, email: false, sms: false },
    },
    billing: { plan: 'FAY OS', price: 0, card: '', nextInvoice: null },
  },
};

const INTEGRATIONS = [
  ['chat', 'WhatsApp Business', 'Guest messaging', 'Disconnected'],
  ['smart_toy', 'n8n AI Concierge', 'Automated replies in the guest app chat', 'Disconnected'],
  ['home_iot_device', 'Smart Home Hub', 'Residence devices', 'Disconnected'],
];

const EMPLOYEE_CATEGORIES = [
  ['manager', 'Manager', false, false, true],
  ['receptionist', 'Receptionist', true, true, false],
  ['concierge', 'Concierge', true, true, false],
  ['housekeeping', 'Housekeeping', true, true, false],
  ['maintenance', 'Maintenance', true, true, false],
  ['security', 'Security', true, true, false],
  ['chef', 'Chef / Kitchen', true, true, false],
  ['therapist', 'Spa Therapist', true, true, false],
  ['trainer', 'Fitness Trainer', true, true, false],
  ['driver', 'Driver', true, true, false],
  ['accountant', 'Accountant', false, true, true],
  ['hr', 'HR', false, true, true],
];

const LEAVE_TYPES = [
  ['Annual Leave', 'Paid annual leave', 21, true],
  ['Sick Leave', 'Leave for illness, with a medical certificate beyond two days', 10, true],
  ['Maternity Leave', 'Maternity leave', 98, true],
  ['Paternity Leave', 'Paternity leave', 10, true],
  ['Compassionate Leave', 'Bereavement and family emergencies', 5, true],
  ['Unpaid Leave', 'Leave without pay', 0, false],
];

const DEPARTMENTS = [
  ['Management', 'Property and general management'],
  ['Front Office', 'Reception, concierge and guest relations'],
  ['Housekeeping', 'Residence cleaning and laundry'],
  ['Maintenance', 'Engineering, repairs and the grounds'],
  ['Wellness', 'Spa, fitness and wellness journeys'],
  ['Food & Beverage', 'Dining, in-residence dining and the kitchen'],
  ['Transport', 'Drivers and airport transfers'],
  ['Security', 'Security and access'],
  ['Finance', 'Accounts and payments'],
  ['Human Resources', 'People and recruitment'],
];

// The wellness catalogue the guest app shows on its Restore / Recharge / Reflect / Explore screens. Service names
// match the app's experience cards. Prices start at 0 (included); set them in HQ → Wellness → Activities.
const JOURNEYS = [
  {
    category: 'restore', name: 'Restore', icon: '🌿', order: 1, capacity: 2,
    description: 'Slow down, ease the body and recover fully: three sequenced stages of release, heat and cold.',
    benefits: ['Deep muscle relaxation', 'Better circulation', 'Stress relief'],
    stages: [
      ['Massage Therapy', 'Restorative bodywork that releases tension', 60, '✋', 'massage'],
      ['Steam Room', 'Cedar-lined steam with eucalyptus', 20, '♨️', 'steam'],
      ['Cold Plunge', 'Guided cold immersion to finish', 10, '❄️', 'cold_plunge'],
    ],
  },
  {
    category: 'recharge', name: 'Recharge', icon: '⚡', order: 2, capacity: 4,
    description: 'Energise and revitalise: a coached workout, recovery and a nutrition plan for the rest of your stay.',
    benefits: ['More energy', 'Better focus', 'Physical vitality'],
    stages: [
      ['Coached Workout', 'Strength and conditioning with a trainer', 45, '🏋️', 'training'],
      ['Recovery', 'Stretching and percussion recovery', 15, '🧘', 'recovery'],
      ['Nutrition Plan', 'A short consultation and a plan for your stay', 15, '🥗', 'nutrition'],
    ],
  },
  {
    category: 'reflect', name: 'Reflect', icon: '🌅', order: 3, capacity: 8,
    description: 'Find calm and balance through breathwork, meditation and the sunset ceremony.',
    benefits: ['Inner calm', 'Mental clarity', 'Better sleep'],
    stages: [
      ['Breathwork', 'Guided breathing to settle the mind', 15, '🌬️', 'breathwork'],
      ['Meditation', 'Guided meditation', 30, '🧘', 'meditation'],
      ['Sunset Ceremony', 'Evening reflection and gratitude', 30, '🌇', 'ceremony'],
    ],
  },
  {
    category: 'explore', name: 'Explore', icon: '🌍', order: 4, capacity: 8,
    description: 'Discover the estate and the region: a guided nature walk and a local culture experience.',
    benefits: ['Time in nature', 'Local culture', 'New experiences'],
    stages: [
      ['Nature Walk', 'Guided walk through the estate', 60, '🌳', 'walk'],
      ['Local Culture', 'Crafts, music and stories of the region', 60, '🎨', 'culture'],
    ],
  },
];

// [category, name, minutes, capacity per slot, needs a staff member, icon, description]
const SERVICES = [
  ['restore', 'Massage Therapy', 60, 1, true, '💆', 'Restorative bodywork tailored to release tension'],
  ['restore', 'Steam Room', 20, 6, false, '♨️', 'Cedar-lined steam with aromatic eucalyptus'],
  ['restore', 'Cold Plunge', 10, 2, false, '❄️', 'Supervised cold immersion for recovery'],
  ['recharge', 'Gym & Training', 60, 15, false, '💪', 'The fully equipped gym'],
  ['recharge', 'Personal Trainer', 60, 1, true, '🏋️', 'One-to-one coaching built around your goals'],
  ['recharge', 'Group Classes', 45, 10, true, '🤸', 'High-energy group sessions'],
  ['recharge', 'Nutrition', 45, 1, true, '🥗', 'A consultation with our nutritionist'],
  ['reflect', 'Sunset Ceremony', 45, 12, true, '🌇', 'Evening reflection and gratitude'],
  ['reflect', 'Meditation', 30, 10, true, '🧘', 'Guided mindfulness practice'],
  ['reflect', 'Nature Walk', 60, 8, true, '🌳', 'A guided walk through the estate'],
  ['explore', 'Local Culture', 90, 8, true, '🎨', 'Immersive local culture and traditions'],
  ['dining', 'Private Chef', 180, 1, true, '👨‍🍳', 'A chef prepares dinner in your residence'],
];

async function load(client) {
  await client.query(
    `INSERT INTO properties (code, name, city, country, status) VALUES ('FWR', 'Faysha Wellness Residence', NULL, 'Cameroon', 'active')
     ON CONFLICT (code) DO NOTHING`
  );

  for (const r of ROLES) {
    await client.query(
      `INSERT INTO roles (name, display_name, description, permissions, is_system_role) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO NOTHING`,
      [r.name, r.display_name, r.description, JSON.stringify(r.permissions), r.system]
    );
  }

  for (const [key, value] of Object.entries(SETTINGS)) {
    await client.query(`INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, [key, JSON.stringify(value)]);
  }

  for (const [icon, name, detail, status] of INTEGRATIONS) {
    await client.query(
      `INSERT INTO integrations (icon, name, detail, status) SELECT $1, $2::varchar, $3, $4 WHERE NOT EXISTS (SELECT 1 FROM integrations WHERE name = $2::varchar)`,
      [icon, name, detail, status]
    );
  }

  for (const [name, display, keycard, clockIn, remote] of EMPLOYEE_CATEGORIES) {
    await client.query(
      `INSERT INTO employee_categories (name, display_name, requires_keycard, requires_clock_in, can_work_remotely)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO NOTHING`,
      [name, display, keycard, clockIn, remote]
    );
  }
  for (const [name, description, days, paid] of LEAVE_TYPES) {
    await client.query(
      `INSERT INTO leave_types (name, description, days_per_year, is_paid) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO NOTHING`,
      [name, description, days, paid]
    );
  }
  for (const [name, description] of DEPARTMENTS) {
    await client.query(`INSERT INTO departments (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`, [name, description]);
  }

  for (const j of JOURNEYS) {
    const total = j.stages.reduce((sum, stage) => sum + stage[2], 0);
    const { rows } = await client.query(
      `INSERT INTO wellness_activities (type, category, name, display_name, description, icon, duration, requires_staff,
                                        requires_access_pin, max_capacity, has_stages, total_stages, display_order, benefits)
       VALUES ('journey', $1, $2, $2, $3, $4, $5, true, true, $6, true, $7, $8, $9)
       ON CONFLICT (name, category) DO NOTHING RETURNING id`,
      [j.category, j.name, j.description, j.icon, total, j.capacity, j.stages.length, j.order, j.benefits]
    );
    if (!rows[0]) continue;
    for (const [i, [name, description, duration, icon, type]] of j.stages.entries()) {
      await client.query(
        `INSERT INTO wellness_activity_stages (activity_id, stage_number, name, description, duration, icon, activity_type, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $2)`,
        [rows[0].id, i + 1, name, description, duration, icon, type]
      );
    }
  }
  for (const [i, [category, name, duration, capacity, staff, icon, description]] of SERVICES.entries()) {
    await client.query(
      `INSERT INTO wellness_activities (type, category, name, display_name, description, icon, duration, requires_staff, max_capacity, display_order)
       VALUES ('service', $1, $2, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (name, category) DO NOTHING`,
      [category, name, description, icon, duration, staff, capacity, 100 + i]
    );
  }
}

module.exports = { load, ROLES };
