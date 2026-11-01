import moment from 'moment';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { opsApi, residencesApi } from '../api';
import FormDialog from '../components/FormDialog';
import { Empty, Facts, Pill, SearchBox, Tabs, Toolbar } from '../components/kit';
import { Bar, Icon, KpiGrid } from '../components/ui';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import { money, moneyShort } from './guest360/format';

const CATEGORIES = [
  ['hvac', 'Air conditioning'], ['electrical', 'Electrical & generator'], ['plumbing', 'Plumbing & water'], ['kitchen', 'Kitchen'], ['laundry', 'Laundry'],
  ['pool', 'Pool'], ['gym', 'Gym'], ['spa', 'Spa'], ['furniture', 'Furniture'], ['electronics', 'Electronics & smart home'], ['vehicle', 'Vehicles'],
  ['building', 'Building & paint'], ['outdoor', 'Gardens & outdoor'], ['security', 'Security'], ['other', 'Other'],
];
const KINDS = [['service', 'Service'], ['inspection', 'Inspection'], ['deep_clean', 'Deep clean'], ['repaint', 'Repaint'], ['calibration', 'Calibration'], ['replace', 'Planned replacement'], ['other', 'Other']];
const UNITS = [['day', 'days'], ['week', 'weeks'], ['month', 'months'], ['year', 'years']];
const CRIT = { critical: ['Critical', '#ff6b6b'], high: ['High', '#e8b84a'], normal: ['Normal', '#5b8ff0'], low: ['Low', '#8f897d'] };
const STATUS = { in_service: ['In service', '#3fd283'], needs_attention: ['Needs attention', '#e8b84a'], out_of_service: ['Out of service', '#ff6b6b'], retired: ['Retired', '#8f897d'] };
const FLAG = { order_soon: ['Order replacement', '#e8b84a'], spares_low: ['Spares low', '#ff6b6b'], warranty_ending: ['Warranty ending', '#5b8ff0'], out_of_service: ['Down', '#ff6b6b'], needs_attention: ['Attention', '#e8b84a'] };
const catLabel = (c) => CATEGORIES.find(([k]) => k === c)?.[1] || c;
const life = (a) => (a.lifeLeftMonths === null || a.lifeLeftMonths === undefined ? '—' : a.lifeLeftMonths < 0 ? `${-a.lifeLeftMonths} mo past life` : a.lifeLeftMonths >= 24 ? `${Math.floor(a.lifeLeftMonths / 12)} yr left` : `${a.lifeLeftMonths} mo left`);

const assetFields = (residenceOptions) => [
  { name: 'code', label: 'Code', required: true, helperText: 'Written on the equipment: AC-E401, GEN-01, POOL-PUMP-1' },
  { name: 'name', label: 'Name', required: true },
  { name: 'category', label: 'Category', type: 'select', options: CATEGORIES },
  { name: 'criticality', label: 'How critical', type: 'select', options: [['critical', 'Critical — the business stops without it'], ['high', 'High'], ['normal', 'Normal'], ['low', 'Low']] },
  { name: 'apartmentId', label: 'Residence (if it is in one)', type: 'select', options: [['', '—'], ...residenceOptions] },
  { name: 'location', label: 'Location', helperText: 'Plant room, kitchen, gym…' },
  { name: 'brand', label: 'Brand' },
  { name: 'model', label: 'Model' },
  { name: 'supplier', label: 'Supplier' },
  { name: 'purchaseDate', label: 'Purchased on', type: 'date' },
  { name: 'purchaseCost', label: 'Purchase cost', type: 'number' },
  { name: 'expectedLifeMonths', label: 'Expected life (months)', type: 'number', helperText: 'AC ≈ 96, pool pump ≈ 60, generator ≈ 180, mattress ≈ 96, paint ≈ 36' },
  { name: 'replacementCost', label: 'Replacement cost today', type: 'number', helperText: 'Including shipping and fitting' },
  { name: 'leadTimeDays', label: 'Days from order to installed', type: 'number' },
  { name: 'warrantyUntil', label: 'Warranty until', type: 'date' },
  { name: 'sparesMin', label: 'Spares / standby units to keep', type: 'number', helperText: 'Keep 1–2 for anything that takes long to ship' },
  { name: 'sparesOnHand', label: 'Spares in stock', type: 'number' },
  { name: 'reserveOverride', label: 'Monthly reserve (leave empty to compute)', type: 'number' },
  { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
];

/**
 * Assets: the register of what the property owns, the care schedule (servicing, repainting, deep cleaning),
 * and the replacement reserve set aside each month so nothing has to wait for money or shipping when it fails.
 */
export default function Assets() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'register';
  const selectedId = params.get('id') ? Number(params.get('id')) : null;
  const go = (next) => setParams(Object.fromEntries(Object.entries({ tab, ...next }).filter(([, v]) => v !== null && v !== undefined)));
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState(null);
  const listQ = useApi(opsApi.assets, [], []);
  const tasksQ = useApi(() => opsApi.assetTasks(tab === 'schedule' ? 365 : 60), [tab], []);
  const budgetQ = useApi(opsApi.assetBudget, [], null);
  const detailQ = useApi(() => (selectedId ? opsApi.asset(selectedId) : Promise.resolve(null)), [selectedId], null);
  const residences = useApi(residencesApi.list, [], []);
  const residenceOptions = (residences.data || []).map((r) => [r.id, r.unit || r.name || r.residence || `#${r.id}`]);
  const reloadAll = () => {
    listQ.reload();
    tasksQ.reload();
    budgetQ.reload();
    if (selectedId) detailQ.reload();
  };
  const act = (p, message) => p.then(() => { reloadAll(); toast(message); }).catch((e) => { toast(e.message, 'error'); throw e; });

  const assets = (listQ.data || []).filter((a) => !q.trim() || `${a.code} ${a.name} ${a.location || ''} ${a.residence || ''} ${catLabel(a.category)}`.toLowerCase().includes(q.trim().toLowerCase()));
  const b = budgetQ.data || {};
  const tasks = tasksQ.data || [];
  const kpis = [
    { icon: 'savings', c: '#e8b84a', n: moneyShort(b.monthlyReserve || 0), l: 'To set aside this month' },
    { icon: 'account_balance', c: '#3fd283', n: b.fundedPct === null || b.fundedPct === undefined ? '—' : `${b.fundedPct}%`, l: `Reserve ${moneyShort(b.reserveBalance || 0)} of ${moneyShort(b.replacementValue || 0)}` },
    { icon: 'event_busy', c: '#ff6b6b', n: tasks.filter((t) => t.overdue).length, l: 'Care overdue', dc: '#ff6b6b' },
    { icon: 'shopping_cart', c: '#e8b84a', n: b.orderSoon || 0, l: 'Replacements to order' },
    { icon: 'inventory', c: '#ff6b6b', n: b.sparesLow || 0, l: 'Spares below minimum' },
  ];

  const cur = detailQ.data;
  return (
    <div className="stack">
      <KpiGrid items={kpis} min={175} />
      <Toolbar
        right={
          <>
            {tab === 'register' ? <SearchBox value={q} onChange={setQ} placeholder="Search assets…" style={{ width: 240, maxWidth: '100%' }} /> : null}
            <button type="button" className="fay-btn-outline" onClick={() => setDialog({ task: {} })}><Icon name="event_repeat" size={18} /> Schedule care</button>
            <button type="button" className="btn-gold" onClick={() => setDialog({ asset: {} })}><Icon name="add" size={18} /> Add an asset</button>
          </>
        }
      >
        <Tabs value={tab} onChange={(t) => go({ tab: t, id: null })} options={[['register', 'Register', (listQ.data || []).length], ['schedule', 'Care schedule', tasks.filter((t) => t.dueInDays <= 30).length], ['budget', 'Budget & reserve']]} />
      </Toolbar>

      {cur ? (
        <AssetDetail asset={cur} onClose={() => go({ id: null })} onEdit={() => setDialog({ asset: cur })} act={act} onTask={() => setDialog({ task: { assetId: cur.id } })} />
      ) : null}

      {tab === 'register' && !cur ? (
        <section className="card kit-scroll" style={{ padding: 6 }}>
          {assets.length === 0 && !listQ.loading ? (
            <Empty icon="handyman" title="No assets yet">
              Add what the property depends on — air conditioners, the generator, pumps, kitchen and laundry machines, gym equipment, mattresses, the paintwork — with its cost and expected life.
            </Empty>
          ) : null}
          {assets.length ? (
            <table className="kit-table" style={{ minWidth: 980 }}>
              <thead>
                <tr><th>Asset</th><th>Where</th><th>Criticality</th><th>Life</th><th>Order by</th><th>Monthly reserve</th><th>Funded</th><th>Spares</th><th>Status</th></tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="clickable" onClick={() => go({ id: a.id })}>
                    <td>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, color: 'var(--dim)' }}>{a.code}</span>
                      <div>{a.name}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>{a.flags.map((f) => <Pill key={f} tone={FLAG[f][1]}>{FLAG[f][0]}</Pill>)}</div>
                    </td>
                    <td>{a.residence ? `Residence ${a.residence}` : a.location || '—'}<div className="sub">{catLabel(a.category)}</div></td>
                    <td><Pill tone={CRIT[a.criticality][1]}>{CRIT[a.criticality][0]}</Pill></td>
                    <td style={{ color: a.lifeLeftMonths !== null && a.lifeLeftMonths < 6 ? 'var(--red-soft)' : undefined }}>{life(a)}</td>
                    <td>{a.orderBy ? moment(a.orderBy).format('MMM YYYY') : '—'}</td>
                    <td>{a.monthlyReserve ? money(a.monthlyReserve, a.currency) : '—'}</td>
                    <td style={{ minWidth: 110 }}>{a.fundedPct === null ? '—' : <><Bar value={`${a.fundedPct}%`} /><span className="sub">{a.fundedPct}%</span></>}</td>
                    <td style={{ color: a.sparesOnHand < a.sparesMin ? 'var(--red-soft)' : undefined }}>{a.sparesMin ? `${a.sparesOnHand}/${a.sparesMin}` : '—'}</td>
                    <td><Pill tone={STATUS[a.status][1]}>{STATUS[a.status][0]}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {tab === 'schedule' && !cur ? (
        <section className="card kit-scroll" style={{ padding: 6 }}>
          {tasks.length === 0 && !tasksQ.loading ? <Empty icon="event_repeat" title="Nothing scheduled">Schedule recurring care: AC filters every 3 months, repainting every 3 years, a deep clean of the estate twice a year.</Empty> : null}
          {tasks.length ? (
            <table className="kit-table" style={{ minWidth: 820 }}>
              <thead><tr><th>Due</th><th>What</th><th>For</th><th>Every</th><th>Team / vendor</th><th>Est. cost</th><th /></tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ color: t.overdue ? 'var(--red-soft)' : t.dueInDays <= 7 ? 'var(--gold)' : undefined, whiteSpace: 'nowrap' }}>
                      {moment(t.nextDue).format('ddd D MMM YYYY')}
                      <div className="sub">{t.overdue ? `${-t.dueInDays} days overdue` : t.dueInDays === 0 ? 'today' : `in ${t.dueInDays} days`}</div>
                    </td>
                    <td>{t.title}<div className="sub">{KINDS.find(([k]) => k === t.kind)?.[1]}</div></td>
                    <td>{t.assetId ? <button type="button" className="card-link" onClick={() => go({ id: t.assetId })}>{t.assetCode} · {t.assetName}</button> : t.area}</td>
                    <td>{t.everyN} {UNITS.find(([u]) => u === t.everyUnit)?.[1]}</td>
                    <td>{[t.team, t.vendor].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{t.estCost ? money(t.estCost) : '—'}</td>
                    <td><button type="button" className="btn-gold" onClick={() => setDialog({ done: t })}>Done</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {tab === 'budget' && !cur && budgetQ.data ? <Budget b={budgetQ.data} onOpen={(id) => go({ id })} /> : null}

      <FormDialog
        open={!!dialog?.asset}
        title={dialog?.asset?.id ? `Edit ${dialog.asset.code}` : 'Add an asset'}
        submitLabel="Save"
        fields={[...assetFields(residenceOptions), ...(dialog?.asset?.id ? [{ name: 'status', label: 'Status', type: 'select', options: Object.entries(STATUS).map(([k, [l]]) => [k, l]) }] : [])]}
        initial={dialog?.asset?.id ? { ...dialog.asset, apartmentId: dialog.asset.apartmentId || '', reserveOverride: dialog.asset.reserveOverride ?? '' } : { category: 'hvac', criticality: 'normal', sparesMin: 0, sparesOnHand: 0, leadTimeDays: 14 }}
        onSubmit={(v) => {
          const body = { ...v, apartmentId: v.apartmentId || null, reserveOverride: v.reserveOverride === '' ? null : v.reserveOverride };
          return act(dialog.asset.id ? opsApi.updateAsset(dialog.asset.id, body) : opsApi.createAsset(body), 'Saved');
        }}
        onClose={() => setDialog(null)}
      />
      <FormDialog
        open={!!dialog?.task}
        title="Schedule recurring care"
        submitLabel="Schedule"
        fields={[
          { name: 'assetId', label: 'Asset', type: 'select', options: [['', '— an area, not one asset —'], ...(listQ.data || []).filter((a) => a.status !== 'retired').map((a) => [a.id, `${a.code} · ${a.name}`])] },
          { name: 'area', label: 'Area (when not one asset)', helperText: 'Lobby and corridors, All residences, Facade…' },
          { name: 'title', label: 'What', required: true, helperText: 'Clean filters, repaint, deep clean, service the generator…' },
          { name: 'kind', label: 'Kind', type: 'select', options: KINDS },
          { name: 'everyN', label: 'Every', type: 'number' },
          { name: 'everyUnit', label: 'Unit', type: 'select', options: UNITS },
          { name: 'nextDue', label: 'Next due', type: 'date', required: true },
          { name: 'team', label: 'Team' },
          { name: 'vendor', label: 'Vendor' },
          { name: 'estCost', label: 'Estimated cost each time', type: 'number' },
          { name: 'instructions', label: 'Instructions', type: 'textarea', rows: 2 },
        ]}
        initial={{ assetId: dialog?.task?.assetId || '', kind: 'service', everyN: 3, everyUnit: 'month', nextDue: moment().add(7, 'days').format('YYYY-MM-DD'), team: 'Maintenance' }}
        onSubmit={(v) => act(opsApi.createAssetTask({ ...v, assetId: v.assetId || null }), 'Scheduled — it will appear in alerts when due')}
        onClose={() => setDialog(null)}
      />
      <FormDialog
        open={!!dialog?.done}
        title={`Done: ${dialog?.done?.title || ''}`}
        subtitle="Logged in the asset’s history; the next one is scheduled from today."
        submitLabel="Record"
        fields={[
          { name: 'date', label: 'Done on', type: 'date' },
          { name: 'cost', label: 'Cost', type: 'number' },
          { name: 'by', label: 'By (person or vendor)' },
          { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
        ]}
        initial={{ date: moment().format('YYYY-MM-DD'), cost: dialog?.done?.estCost || '' }}
        onSubmit={(v) => act(opsApi.assetTaskDone(dialog.done.id, v), 'Recorded')}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

function AssetDetail({ asset: a, onClose, onEdit, act, onTask }) {
  const [form, setForm] = useState(null);
  return (
    <section className="card" style={{ gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <button type="button" className="kit-back" style={{ display: 'inline-flex' }} onClick={onClose}><Icon name="arrow_back" size={18} /> All assets</button>
        <div className="col" style={{ flex: 1, minWidth: 220, gap: 4 }}>
          <span className="kit-label">{a.code} · {catLabel(a.category)}</span>
          <h2 className="kit-h">{a.name}</h2>
        </div>
        <Pill tone={CRIT[a.criticality][1]}>{CRIT[a.criticality][0]}</Pill>
        <Pill tone={STATUS[a.status][1]}>{STATUS[a.status][0]}</Pill>
      </div>
      <Facts
        items={[
          ['Where', a.residence ? `Residence ${a.residence}` : a.location],
          ['Make', [a.brand, a.model].filter(Boolean).join(' ')],
          ['Supplier', a.supplier],
          ['Purchased', a.purchaseDate ? `${moment(a.purchaseDate).format('D MMM YYYY')}${a.purchaseCost ? ` · ${money(a.purchaseCost, a.currency)}` : ''}` : null],
          ['Expected life', a.expectedLifeMonths ? `${a.expectedLifeMonths} months · ${life(a)}` : null],
          ['Replace by', a.replaceBy ? moment(a.replaceBy).format('D MMM YYYY') : null],
          ['Order by', a.orderBy ? `${moment(a.orderBy).format('D MMM YYYY')} (${a.leadTimeDays} days to arrive)` : null],
          ['Warranty', a.warrantyUntil ? `until ${moment(a.warrantyUntil).format('D MMM YYYY')}` : null],
          ['Replacement cost', a.replacementCost ? money(a.replacementCost, a.currency) : null],
          ['Reserve', `${money(a.reserveBalance, a.currency)}${a.fundedPct !== null ? ` · ${a.fundedPct}% funded` : ''}`],
          ['Set aside monthly', a.monthlyReserve ? `${money(a.monthlyReserve, a.currency)}${a.reserveOverride !== null ? ' (set by hand)' : ''}` : '—'],
          ['Spares', a.sparesMin ? `${a.sparesOnHand} in stock · keep ${a.sparesMin}` : 'None kept'],
        ]}
      />
      {a.notes ? <div className="kit-message" style={{ fontSize: 14 }}>{a.notes}</div> : null}
      <div className="kit-actions">
        <button type="button" className="fay-btn-outline" onClick={onEdit}><Icon name="edit" size={18} /> Edit</button>
        <button type="button" className="fay-btn-outline" onClick={onTask}><Icon name="event_repeat" size={18} /> Schedule care</button>
        <button type="button" className="fay-btn-outline" onClick={() => setForm('repair')}><Icon name="build" size={18} /> Log repair / note</button>
        {a.status === 'in_service' ? <button type="button" className="fay-btn-outline" onClick={() => act(opsApi.updateAsset(a.id, { status: 'out_of_service' }), 'Marked out of service')}><Icon name="report" size={18} /> Out of service</button> : null}
        {a.status === 'out_of_service' || a.status === 'needs_attention' ? <button type="button" className="fay-btn-outline" onClick={() => act(opsApi.updateAsset(a.id, { status: 'in_service' }), 'Back in service')}><Icon name="check_circle" size={18} /> Back in service</button> : null}
        <button type="button" className="btn-gold" onClick={() => setForm('replace')}><Icon name="autorenew" size={18} /> Replaced it</button>
      </div>

      {a.tasks?.length ? (
        <>
          <span className="card-title">Care schedule</span>
          {a.tasks.map((t) => (
            <div key={t.id} className="row-line" style={{ display: 'flex', gap: 12, padding: '8px 0', fontSize: 14, flexWrap: 'wrap' }}>
              <span style={{ flex: 1 }}>{t.title} · every {t.everyN} {UNITS.find(([u]) => u === t.everyUnit)?.[1]}</span>
              <span style={{ color: t.overdue ? 'var(--red-soft)' : 'var(--dim)' }}>next {moment(t.nextDue).format('D MMM YYYY')}{t.lastDone ? ` · last ${moment(t.lastDone).format('D MMM YYYY')}` : ''}</span>
            </div>
          ))}
        </>
      ) : null}
      <span className="card-title">History</span>
      {(a.logs || []).map((l) => (
        <div key={l.id} className="row-line" style={{ display: 'grid', gridTemplateColumns: '110px 100px 1fr auto', gap: 10, padding: '8px 0', fontSize: 13.5 }}>
          <span style={{ color: 'var(--dim)' }}>{moment(l.date).format('D MMM YYYY')}</span>
          <span style={{ textTransform: 'capitalize' }}>{l.kind}</span>
          <span>{l.notes}{l.by ? <span className="sub"> · {l.by}</span> : null}</span>
          <span>{l.cost ? money(l.cost, a.currency) : ''}</span>
        </div>
      ))}
      <FormDialog
        open={form === 'repair'}
        title="Log a repair, inspection or note"
        submitLabel="Log"
        fields={[
          { name: 'kind', label: 'Kind', type: 'select', options: [['repair', 'Repair'], ['inspection', 'Inspection'], ['service', 'Service'], ['note', 'Note']] },
          { name: 'date', label: 'Date', type: 'date' },
          { name: 'cost', label: 'Cost', type: 'number' },
          { name: 'notes', label: 'What happened', type: 'textarea', rows: 3, required: true },
          { name: 'status', label: 'Status after', type: 'select', options: Object.entries(STATUS).filter(([k]) => k !== 'retired').map(([k, [l]]) => [k, l]) },
        ]}
        initial={{ kind: 'repair', date: moment().format('YYYY-MM-DD'), status: a.status === 'retired' ? 'in_service' : a.status }}
        onSubmit={(v) => act(opsApi.logAsset(a.id, v), 'Logged')}
        onClose={() => setForm(null)}
      />
      <FormDialog
        open={form === 'replace'}
        title={`Replaced ${a.name}`}
        subtitle={`Paid from the reserve first (${money(a.reserveBalance, a.currency)} available); the new unit starts a new life.`}
        submitLabel="Record replacement"
        fields={[
          { name: 'date', label: 'Installed on', type: 'date' },
          { name: 'cost', label: 'What it cost', type: 'number', required: true },
          { name: 'serial', label: 'New serial number' },
          { name: 'warrantyUntil', label: 'New warranty until', type: 'date' },
          { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
        ]}
        initial={{ date: moment().format('YYYY-MM-DD'), cost: a.replacementCost || '' }}
        onSubmit={(v) => act(opsApi.replaceAsset(a.id, v), 'Replacement recorded')}
        onClose={() => setForm(null)}
      />
    </section>
  );
}

function Budget({ b, onOpen }) {
  const max = Math.max(1, ...b.forecast.map((f) => f.replacementCost + f.careCost));
  return (
    <div className="grid-cols">
      <section className="card" style={{ gap: 10 }}>
        <span className="card-title">Next 12 months</span>
        <span className="sub">Replacements falling due and scheduled care. The monthly reserve ({money(b.monthlyReserve)}) is what keeps these from becoming emergencies.</span>
        {b.forecast.map((f) => (
          <div key={f.month} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 110px', gap: 10, alignItems: 'center', fontSize: 13.5 }}>
            <span style={{ color: 'var(--dim)' }}>{moment(`${f.month}-01`).format('MMM YYYY')}</span>
            <div style={{ display: 'flex', height: 10, borderRadius: 4, overflow: 'hidden', background: 'var(--track)' }}>
              <div style={{ width: `${(f.replacementCost / max) * 100}%`, background: 'var(--gold)' }} title="Replacements" />
              <div style={{ width: `${(f.careCost / max) * 100}%`, background: 'var(--blue-soft)' }} title="Care" />
            </div>
            <span style={{ textAlign: 'right' }}>{f.replacementCost + f.careCost ? moneyShort(f.replacementCost + f.careCost) : '—'}</span>
            {f.replacements.length ? (
              <span className="sub" style={{ gridColumn: '2 / 4' }}>
                Replace: {f.replacements.map((r, i) => (
                  <button key={r.id} type="button" className="card-link" onClick={() => onOpen(r.id)}>{i ? ', ' : ''}{r.code}</button>
                ))}
              </span>
            ) : null}
          </div>
        ))}
        <span className="sub"><span style={{ color: 'var(--gold)' }}>■</span> replacements · <span style={{ color: 'var(--blue-soft)' }}>■</span> scheduled care</span>
      </section>
      <section className="card" style={{ gap: 10 }}>
        <span className="card-title">By category</span>
        {b.byCategory.map((c) => (
          <div key={c.category} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', gap: 10, fontSize: 13.5, alignItems: 'center' }}>
            <span>{catLabel(c.category)}<div className="sub">{c.count} asset{c.count > 1 ? 's' : ''}</div></span>
            <span style={{ textAlign: 'right' }}>{moneyShort(c.value)}</span>
            <span style={{ textAlign: 'right', color: 'var(--gold)' }}>{moneyShort(c.monthly)}/mo</span>
          </div>
        ))}
        <span className="sub" style={{ marginTop: 8 }}>Spent on care and repairs in the last 12 months: {money(b.maintenanceLast12)}</span>
      </section>
    </div>
  );
}
