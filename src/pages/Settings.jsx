import { MenuItem, TextField } from '@mui/material';
import moment from 'moment';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { residencesApi, settingsApi } from '../api';
import FormDialog from '../components/FormDialog';
import { Avatar, Card, Icon, Toggle } from '../components/ui';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useCollection from '../hooks/useCollection';
import { money } from './guest360/format';

/** [label, icon, ?section= key] */
const SECTIONS = [
  ['General', 'tune', 'general'],
  ['Team & Roles', 'badge', 'team'],
  ['Residences & Devices', 'villa', 'residences'],
  ['FAY AI', 'neurology', 'ai'],
  ['Notifications', 'notifications', 'notifications'],
  ['Integrations', 'hub', 'integrations'],
  ['Billing', 'credit_card', 'billing'],
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
/** [preferences.ai key, title, description] */
const AI_TOGGLES = [
  ['autoReply', 'Auto-reply to guest messages', 'FAY answers routine questions instantly, escalates the rest'],
  ['recommendations', 'Proactive recommendations', 'Suggest experiences based on guest preferences'],
  ['autoAssign', 'Auto-assign service requests', 'Route requests to the right team by category & load'],
  ['smartHome', 'Smart home automations', 'Allow FAY to adjust climate & lighting on guest behaviour'],
  ['approvalOver500', 'Require approval for bookings over $500', 'Staff confirms high-value bookings'],
];
const NOTIFY_EVENTS = [
  ['vipArrival', 'VIP arrivals', 'Two hours before a VIP checks in'],
  ['escalation', 'Escalated requests', 'A request passes its SLA or is escalated'],
  ['newRequest', 'New service requests', 'Every new guest request'],
  ['payment', 'Payments', 'Deposits, refunds and failed payments'],
  ['deviceAlert', 'Device alerts', 'Smart-home devices offline or out of range'],
];
const ROLES = ['Administrator', 'General Manager', 'Supervisor', 'Staff', 'Technician', 'Chauffeur', 'Therapist'];
const DEPARTMENTS = ['Management', 'Front Office', 'Housekeeping', 'Maintenance', 'Dining', 'Wellness', 'Transportation', 'Experiences'];
const INTEGRATION_COLOR = { Connected: '#3fd283', 'Action needed': '#e8b84a', Disconnected: '#8f897d' };

export default function Settings() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section = Math.max(0, SECTIONS.findIndex(([, , key]) => key === params.get('section')));
  const setSection = (i) => setParams({ section: SECTIONS[i][2] });

  const { data } = useApi(settingsApi.getProperty, [], null);
  const prefsQ = useApi(settingsApi.getPreferences, [], null);
  const residences = useApi(residencesApi.list, [], []);
  const team = useCollection('team');
  const integrations = useCollection('integrations');
  const invoices = useCollection('invoices');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [teamQ, setTeamQ] = useState('');
  useEffect(() => setForm(data), [data]);
  const prefs = prefsQ.data;

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
  /** Optimistic deep update of preferences[group]. */
  const savePrefs = (group, value, message) => {
    const before = prefs;
    prefsQ.setData((p) => ({ ...p, [group]: { ...p[group], ...value } }));
    settingsApi
      .savePreferences({ [group]: value })
      .then(() => message && toast(message))
      .catch((e) => {
        prefsQ.setData(before);
        toast(e.message, 'error');
      });
  };

  const sectionCard = (title, children, aside) => (
    <Card title={title} titleSize={24} padding={20} gap={8} headGap={6} aside={aside}>
      {children}
    </Card>
  );

  const propertyCard = (
    <Card
      title="Property"
      titleSize={24}
      padding={20}
      gap={14}
      aside={
        <button type="button" className="btn-gold" onClick={save} disabled={!form || saving}>
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
  );

  const aiCard = sectionCard(
    'FAY AI Behaviour',
    AI_TOGGLES.map(([key, title, d]) => (
      <div key={key} className="row-line" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 0' }}>
        <div className="col" style={{ flex: 1 }}>
          <span style={{ fontSize: 15 }}>{title}</span>
          <span className="sub">{d}</span>
        </div>
        <Toggle size="lg" on={!!prefs?.ai[key]} label={title} onClick={() => savePrefs('ai', { [key]: !prefs.ai[key] }, `${title} ${prefs.ai[key] ? 'off' : 'on'}`)} />
      </div>
    )),
  );

  const integrationTile = (x) => (
    <div key={x.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
      <Icon name={x.icon} size={26} color="var(--gold)" />
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14 }}>{x.name}</span>
        <span style={{ fontSize: 12, color: INTEGRATION_COLOR[x.status] }}>
          {x.status} · <span style={{ color: 'var(--muted)' }}>{x.detail}</span>
        </span>
      </div>
      {x.status === 'Connected' ? (
        <button type="button" className="btn-outline" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => integrations.update(x.id, { status: 'Disconnected' }, `${x.name} disconnected`)}>
          Disconnect
        </button>
      ) : (
        <button type="button" className="btn-gold" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setDialog({ kind: 'integration', integration: x })}>
          {x.status === 'Action needed' ? 'Fix' : 'Connect'}
        </button>
      )}
    </div>
  );
  const integrationsCard = sectionCard('Integrations', <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>{integrations.items.map(integrationTile)}</div>);

  const query = teamQ.trim().toLowerCase();
  const teamCard = sectionCard(
    `Team & Roles (${team.items.length})`,
    <>
      <input
        value={teamQ}
        onChange={(e) => setTeamQ(e.target.value)}
        placeholder="Search team…"
        aria-label="Search team"
        style={{ ...inputStyle, fontFamily: 'var(--sans)' }}
      />
      {team.items
        .filter((m) => !query || `${m.name} ${m.email} ${m.role} ${m.department}`.toLowerCase().includes(query))
        .map((m) => (
          <div key={m.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '36px 1fr 170px 150px auto', gap: 12, alignItems: 'center', padding: '8px 0', opacity: m.status === 'Deactivated' ? 0.5 : 1 }}>
            <Avatar size={36} />
            <div className="col" style={{ minWidth: 0 }}>
              <span style={{ fontSize: 14 }}>
                {m.name}
                {m.status !== 'Active' && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gold)' }}>{m.status}</span>}
              </span>
              <span className="sub">{m.email}</span>
            </div>
            <TextField select size="small" value={m.role} onChange={(e) => team.update(m.id, { role: e.target.value }, `${m.name} is now ${e.target.value}`)} aria-label={`${m.name} role`}>
              {ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </TextField>
            <span className="sub">{m.department}</span>
            {m.status === 'Invited' ? (
              <button type="button" className="btn-outline" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => toast(`Invitation re-sent to ${m.email}`)}>
                Resend
              </button>
            ) : (
              <button
                type="button"
                className="btn-outline"
                style={{ padding: '5px 10px', fontSize: 12 }}
                onClick={() => team.update(m.id, { status: m.status === 'Active' ? 'Deactivated' : 'Active' }, `${m.name} ${m.status === 'Active' ? 'deactivated' : 'reactivated'}`)}
              >
                {m.status === 'Active' ? 'Deactivate' : 'Reactivate'}
              </button>
            )}
          </div>
        ))}
    </>,
    <button type="button" className="btn-gold" onClick={() => setDialog({ kind: 'invite' })}>
      <Icon name="person_add" size={18} />
      Invite
    </button>,
  );

  const residencesCard = sectionCard(
    `Residences & Devices (${(residences.data || []).length})`,
    (residences.data || []).map((r) => {
      const off = Object.values(r.devicesOff || {}).filter(Boolean).length;
      return (
        <div key={r.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 110px', gap: 12, alignItems: 'center', padding: '8px 0', fontSize: 14 }}>
          <div className="col">
            <span>{r.name}</span>
            <span className="sub">{r.collection}</span>
          </div>
          <span className="sub">12 devices · {off} off</span>
          <span className="sub">
            {r.targetTemp}° · {r.scene}
          </span>
          <span style={{ fontSize: 12, color: (r.security?.front || 'Secured') === 'Secured' ? 'var(--green-bright)' : '#ff6b6b' }}>Door {(r.security?.front || 'Secured').toLowerCase()}</span>
        </div>
      );
    }),
    <button type="button" className="btn-outline" onClick={() => navigate('/residences')}>
      <Icon name="villa" size={18} />
      Open Residences
    </button>,
  );

  const notificationsCard = sectionCard(
    'Notifications',
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px', gap: 10, fontSize: 12, color: 'var(--dim)', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        <span>Event</span>
        <span>Push</span>
        <span>Email</span>
        <span>SMS</span>
      </div>
      {NOTIFY_EVENTS.map(([key, title, d]) => (
        <div key={key} className="row-line" style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px', gap: 10, alignItems: 'center', padding: '10px 0' }}>
          <div className="col">
            <span style={{ fontSize: 15 }}>{title}</span>
            <span className="sub">{d}</span>
          </div>
          {['push', 'email', 'sms'].map((ch) => (
            <Toggle
              key={ch}
              size="sm"
              on={!!prefs?.notifications[key]?.[ch]}
              label={`${title} ${ch}`}
              onClick={() => savePrefs('notifications', { [key]: { ...prefs.notifications[key], [ch]: !prefs.notifications[key][ch] } }, `${title}: ${ch} ${prefs.notifications[key][ch] ? 'off' : 'on'}`)}
            />
          ))}
        </div>
      ))}
    </>,
    <button
      type="button"
      className="btn-outline"
      onClick={() =>
        settingsApi
          .sendTestNotification()
          .then(() => toast('Test notification sent — check the bell'))
          .catch((e) => toast(e.message, 'error'))
      }
    >
      <Icon name="notifications_active" size={18} />
      Send Test
    </button>,
  );

  const billing = prefs?.billing;
  const billingCard = sectionCard(
    'Billing',
    billing && (
      <>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            [billing.plan, 'Current plan'],
            [`${money(billing.price)} / month`, 'Price'],
            [moment(billing.nextInvoice).format('MMM D, YYYY'), 'Next invoice'],
            [`•••• ${billing.card}`, 'Payment method'],
          ].map(([v, l]) => (
            <div key={l} className="col" style={{ padding: '12px 16px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, gap: 4, minWidth: 170 }}>
              <span className="serif" style={{ fontSize: 22 }}>
                {v}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{l}</span>
            </div>
          ))}
        </div>
        <span style={{ fontSize: 13, color: 'var(--dim)', marginTop: 10 }}>Invoices</span>
        {invoices.items.map((inv) => (
          <div key={inv.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px 70px auto', gap: 10, alignItems: 'center', padding: '8px 0', fontSize: 14 }}>
            <span>{inv.number}</span>
            <span className="sub">{moment(inv.date).format('MMM D, YYYY')}</span>
            <span>{money(inv.amount)}</span>
            <span style={{ fontSize: 12, color: 'var(--green-bright)' }}>{inv.status}</span>
            <button
              type="button"
              className="mini-btn"
              title="Download" aria-label="Download"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([`FAY OS invoice ${inv.number}\nDate: ${inv.date}\nPlan: ${billing.plan}\nAmount: ${money(inv.amount)}\nStatus: ${inv.status}\n`], { type: 'text/plain' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `${inv.number}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Icon name="download" size={16} />
            </button>
          </div>
        ))}
      </>
    ),
    <button type="button" className="btn-outline" onClick={() => setDialog({ kind: 'card' })}>
      <Icon name="credit_card" size={18} />
      Update Card
    </button>,
  );

  const content = [
    [propertyCard, aiCard, integrationsCard],
    [teamCard],
    [residencesCard],
    [aiCard],
    [notificationsCard],
    [integrationsCard],
    [billingCard],
  ][section];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,240px) minmax(0,1fr)', gap: 14 }}>
      <section className="card" style={{ padding: 10, gap: 2, alignSelf: 'start' }}>
        {SECTIONS.map(([l, icon], i) => (
          <div
            key={l}
            role="tab"
            aria-selected={i === section}
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
        {content.map((c, i) => (
          <div key={i}>{c}</div>
        ))}
      </div>

      <FormDialog
        open={dialog?.kind === 'invite'}
        title="Invite Team Member"
        submitLabel="Send Invitation"
        fields={[
          { name: 'name', label: 'Full name', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'role', label: 'Role', type: 'select', options: ROLES },
          { name: 'department', label: 'Department', type: 'select', options: DEPARTMENTS },
        ]}
        initial={{ role: 'Staff', department: 'Front Office' }}
        onSubmit={(v) => team.create({ ...v, status: 'Invited' }, `Invitation sent to ${v.email}`)}
        onClose={() => setDialog(null)}
      />
      <FormDialog
        open={dialog?.kind === 'integration'}
        title={`Connect ${dialog?.integration?.name || ''}`}
        subtitle="Credentials are stored on the server (never in the browser)."
        submitLabel="Connect"
        fields={[
          { name: 'key', label: 'API key / token', required: true },
          { name: 'account', label: 'Account ID (optional)' },
        ]}
        onSubmit={() => integrations.update(dialog.integration.id, { status: 'Connected' }, `${dialog.integration.name} connected`)}
        onClose={() => setDialog(null)}
      />
      <FormDialog
        open={dialog?.kind === 'card'}
        title="Update Payment Method"
        subtitle="In production this opens Stripe’s card form; here we only keep the last 4 digits."
        submitLabel="Save Card"
        fields={[
          { name: 'number', label: 'Card number', required: true },
          { name: 'expiry', label: 'Expiry (MM/YY)', required: true },
        ]}
        onSubmit={(v) => {
          const digits = v.number.replace(/\D/g, '');
          if (digits.length < 12) return Promise.reject(new Error('Enter a valid card number'));
          savePrefs('billing', { card: digits.slice(-4) }, `Card •••• ${digits.slice(-4)} saved`);
          return Promise.resolve();
        }}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
