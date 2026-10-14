import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { settingsApi } from '../api';
import { Card, Icon, Toggle } from '../components/ui';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';

// Property details load from / save to the API (see docs/API.md); the other sections are still sample data.
const SECTIONS = [
  ['General', 'tune'],
  ['Team & Roles', 'badge'],
  ['Residences & Devices', 'villa'],
  ['FAY AI', 'neurology'],
  ['Notifications', 'notifications'],
  ['Integrations', 'hub'],
  ['Billing', 'credit_card'],
];
/** [label, property key] */
const FIELDS = [
  ['Property name', 'name'],
  ['Brand', 'brand'],
  ['Time zone', 'timeZone'],
  ['Currency', 'currency'],
  ['Check-in time', 'checkInTime'],
  ['Check-out time', 'checkOutTime'],
];
const inputStyle = {
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  fontSize: 14,
  outline: 0,
};
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
  const { t } = useTranslation();
  const toast = useToast();
  const { data } = useApi(settingsApi.getProperty, [], null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(data), [data]);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const save = () => {
    setSaving(true);
    settingsApi
      .saveProperty(form)
      .then((saved) => {
        setForm(saved);
        toast(t('common.saved'));
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setSaving(false));
  };
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
        <Card
          title="Property"
          titleSize={24}
          padding={20}
          gap={14}
          aside={
            <button type="button" className="btn-gold" onClick={save} disabled={!form || saving} style={{ border: 0, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
              <Icon name="save" size={18} />
              {t('common.save')}
            </button>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
            {FIELDS.map(([l, key]) => (
              <label key={key} className="col" style={{ gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                {l}
                <input value={form?.[key] ?? ''} onChange={(e) => set(key, e.target.value)} disabled={!form} style={inputStyle} />
              </label>
            ))}
            <label className="col" style={{ gap: 6, fontSize: 13, color: 'var(--muted)' }}>
              {t('settings.email')}
              <input type="email" value={form?.email ?? ''} onChange={(e) => set('email', e.target.value)} disabled={!form} style={inputStyle} />
            </label>
            <div className="col fay-phone" style={{ gap: 6, fontSize: 13, color: 'var(--muted)' }}>
              {t('settings.phone')}
              <PhoneInput country="ae" value={form?.phone ?? ''} onChange={(v) => set('phone', v)} disabled={!form} enableSearch />
            </div>
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
