import { useState } from 'react';
import { Card, Icon, Toggle } from '../components/ui';

// Mock data — replace with API calls.
const SECTIONS: [string, string][] = [
  ['General', 'tune'],
  ['Team & Roles', 'badge'],
  ['Residences & Devices', 'villa'],
  ['FAY AI', 'neurology'],
  ['Notifications', 'notifications'],
  ['Integrations', 'hub'],
  ['Billing', 'credit_card'],
];
const FIELDS = [
  ['Property name', 'Faysha Wellness Residence'],
  ['Brand', 'FAY OS'],
  ['Time zone', 'Gulf Standard Time (GMT+4)'],
  ['Currency', 'USD ($)'],
  ['Check-in time', '3:00 PM'],
  ['Check-out time', '11:00 AM'],
];
const TOGGLES = [
  ['Auto-reply to guest messages', 'FAY answers routine questions instantly, escalates the rest'],
  ['Proactive recommendations', 'Suggest experiences based on guest preferences'],
  ['Auto-assign service requests', 'Route requests to the right team by category & load'],
  ['Smart home automations', 'Allow FAY to adjust climate & lighting on guest behaviour'],
  ['Require approval for bookings over $500', 'Staff confirms high-value bookings'],
];
const INTEGRATIONS = [
  ['chat', 'WhatsApp Business', 'Connected', '#3fd283'],
  ['mail', 'Email (SMTP)', 'Connected', '#3fd283'],
  ['hotel', 'Property Management', 'Connected', '#3fd283'],
  ['home_iot_device', 'Smart Home Hub', 'Connected · 486 devices', '#3fd283'],
  ['deployed_code', 'Smart Locker Hub', 'Connected · 12 lockers', '#3fd283'],
  ['payments', 'Payments', 'Action needed', '#e8b84a'],
];

export default function Settings() {
  const [section, setSection] = useState(0);
  const [on, setOn] = useState([true, true, true, true, false]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,240px) minmax(0,1fr)', gap: 14 }}>
      <section className="card" style={{ padding: 10, gap: 2, alignSelf: 'start' }}>
        {SECTIONS.map(([l, icon], i) => (
          <div
            key={l}
            onClick={() => setSection(i)}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              background: i === section ? 'rgba(232,184,74,.14)' : 'transparent',
              color: i === section ? 'var(--gold)' : 'var(--text-2)',
            }}
          >
            <Icon name={icon} size={20} />
            {l}
          </div>
        ))}
      </section>

      <div className="stack">
        <Card title="Property" titleSize={24} padding={20} gap={14}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
            {FIELDS.map(([l, v]) => (
              <label key={l} className="col" style={{ gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                {l}
                <input
                  defaultValue={v}
                  readOnly
                  style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14, outline: 0 }}
                />
              </label>
            ))}
          </div>
        </Card>

        <Card title="FAY AI Behaviour" titleSize={24} padding={20} gap={6} headGap={6}>
          {TOGGLES.map(([t, d], i) => (
            <div key={t} className="row-line" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 0' }}>
              <div className="col" style={{ flex: 1 }}>
                <span style={{ fontSize: 15 }}>{t}</span>
                <span className="sub">{d}</span>
              </div>
              <Toggle size="lg" on={on[i]} label={t} onClick={() => setOn((o) => o.map((v, j) => (j === i ? !v : v)))} />
            </div>
          ))}
        </Card>

        <Card title="Integrations" titleSize={24} padding={20}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
            {INTEGRATIONS.map(([icon, n, s, c]) => (
              <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                <Icon name={icon} size={26} color="var(--gold)" />
                <div className="col" style={{ flex: 1 }}>
                  <span style={{ fontSize: 14 }}>{n}</span>
                  <span style={{ fontSize: 12, color: c }}>{s}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
