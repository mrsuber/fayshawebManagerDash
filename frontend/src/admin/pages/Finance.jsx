import { Suspense, useState } from 'react';
import { Card, Icon } from '../../manager/components/ui';
import { useToast } from '../../manager/context/ToastContext';
import { hqApi } from '../api';
import {
  DailyBars, Dialog, ErrorNote, HBars, Loading, Pill, Stat, Tabs, day, isoToday, money, shiftDays, useHq, useLoad,
} from '../components/parts';

const STREAMS = [
  ['stays', 'Stays'],
  ['dining', 'Dining'],
  ['wellness', 'Wellness'],
  ['experiences', 'Experiences'],
  ['other', 'Other services'],
];
const METHOD = { stripe: 'Card (Stripe)', mobile_money: 'Mobile money', cash: 'Cash', bank_transfer: 'Bank transfer', card_terminal: 'Card terminal', room_transfer: 'Room charge' };

export default function Finance({ ledger: Ledger }) {
  const [tab, setTab] = useState('revenue');
  const tabs = [['revenue', 'Revenue'], ['payments', 'Payments']];
  if (Ledger) tabs.push(['ledger', 'Payment ledger (v1)']);
  return (
    <>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'revenue' && <Revenue />}
      {tab === 'payments' && <Payments />}
      {tab === 'ledger' && Ledger && (
        <div className="hq-legacy">
          <Suspense fallback={<Loading />}>
            <Ledger />
          </Suspense>
        </div>
      )}
    </>
  );
}

function presets() {
  const t = isoToday();
  return [
    ['7d', 'Last 7 days', shiftDays(t, -6), t],
    ['30d', 'Last 30 days', shiftDays(t, -29), t],
    ['month', 'This month', `${t.slice(0, 8)}01`, t],
    ['year', 'This year', `${t.slice(0, 5)}01-01`, t],
  ];
}

function downloadCsv(rows, from, to) {
  const head = ['day', ...STREAMS.map(([k]) => k), 'total'];
  const csv = [head.join(','), ...rows.map((r) => head.map((k) => r[k]).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `faysha-revenue-${from}-to-${to}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Revenue() {
  const { property } = useHq();
  const p = presets();
  const [range, setRange] = useState({ id: '30d', from: p[1][2], to: p[1][3] });
  const { data, error, loading, reload } = useLoad(() => hqApi.revenue({ from: range.from, to: range.to, property }), [range.from, range.to, property]);

  return (
    <div className="stack">
      <div className="hq-toolbar">
        <div className="hq-toolbar" role="group" aria-label="Period">
          {p.map(([id, label, from, to]) => (
            <button key={id} type="button" className={`chip${range.id === id ? ' on' : ''}`} onClick={() => setRange({ id, from, to })} style={{ cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
              {label}
            </button>
          ))}
        </div>
        <label className="hq-toolbar sub">
          From <input className="hq-input" type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ id: 'custom', from: e.target.value, to: range.to })} style={{ colorScheme: 'dark' }} />
        </label>
        <label className="hq-toolbar sub">
          to <input className="hq-input" type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ id: 'custom', from: range.from, to: e.target.value })} style={{ colorScheme: 'dark' }} />
        </label>
        <span style={{ flex: 1 }} />
        {data && (
          <button type="button" className="fay-btn-outline" onClick={() => downloadCsv(data.series, data.from, data.to)}>
            <Icon name="download" size={18} /> Export CSV
          </button>
        )}
      </div>

      <ErrorNote error={error} onRetry={reload} />
      {!data && !error && <Loading />}
      {data && (
        <div className="stack" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
          <div className="hq-stats">
            <Stat hero icon="payments" label="Total earned" value={money(data.totals.total)} trend={data.change.total} sub={`vs previous ${data.days} days`} />
            <Stat icon="hotel" label="Stays" value={money(data.totals.stays)} trend={data.change.stays} />
            <Stat icon="restaurant" label="Services" value={money(data.totals.total - data.totals.stays)} sub="dining, wellness, experiences, other" />
            <Stat icon="bed" label="Occupancy" value={`${data.occupancy.rate}%`} sub={`${data.occupancy.nights} of ${data.occupancy.available} residence-nights`} />
            <Stat icon="sell" label="Average nightly rate" value={money(data.adr)} sub="per occupied night" />
            <Stat icon="query_stats" label="RevPAR" value={money(data.revpar)} sub="stay revenue per available night" />
          </div>

          <Card title="Revenue earned per day">
            <DailyBars rows={data.series} detail={(r) => STREAMS.filter(([k]) => r[k]).map(([k, l]) => `${l} ${money(r[k])}`).join(' · ') || 'No revenue'} />
          </Card>

          <div className="grid-cols">
            <Card title="By stream">
              <HBars items={STREAMS.map(([k, label]) => ({ label, value: data.totals[k] })).filter((i) => i.value > 0)} />
            </Card>
            <Card title="Stays by residence type">
              <HBars items={data.byResidenceType.map((r) => ({ label: `${r.name} (${r.nights} nights)`, value: r.revenue }))} />
            </Card>
          </div>

          <Card title="Money collected" aside={<span className="sub">payments received in the period, by method</span>}>
            {data.collected.length === 0 ? (
              <div className="hq-empty">No payments received in this period.</div>
            ) : (
              <div className="hq-table-wrap">
                <table className="hq-table">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th className="hq-num">Payments</th>
                      <th className="hq-num">Collected</th>
                      <th className="hq-num">Refunded</th>
                      <th className="hq-num">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.collected.map((c) => (
                      <tr key={c.method}>
                        <td>{METHOD[c.method] || c.method}</td>
                        <td className="hq-num">{c.count}</td>
                        <td className="hq-num">{money(c.collected)}</td>
                        <td className="hq-num">{c.refunded ? `− ${money(c.refunded)}` : '—'}</td>
                        <td className="hq-num">{money(c.collected - c.refunded)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Payments() {
  const { can } = useHq();
  const toast = useToast();
  const [filters, setFilters] = useState({ status: '', method: '', q: '' });
  const [refund, setRefund] = useState(null);
  const { data, error, loading, reload } = useLoad(() => hqApi.payments(filters), [filters.status, filters.method, filters.q]);
  const [busy, setBusy] = useState(null);

  const markReceived = async (p) => {
    if (!window.confirm(`Confirm that ${money(p.amount)} was received from ${p.guestName}${p.payerPhone ? ` (${p.payerPhone})` : ''}? The booking will be confirmed and the guest receives their digital key.`)) return;
    setBusy(p.id);
    try {
      await hqApi.markPaid(p.id);
      if (p.bookingStatus === 'pending') {
        try {
          await hqApi.confirmBooking(p.bookingId);
          toast(`Payment received — booking ${p.bookingNumber} confirmed and key sent`);
        } catch (e) {
          toast(`Payment recorded, but the booking could not be confirmed: ${e.message}`, 'warning');
        }
      } else toast('Payment recorded');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack">
      <div className="hq-toolbar">
        <input className="hq-input" placeholder="Booking number, guest name or email" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} style={{ minWidth: 260 }} aria-label="Search payments" />
        <select className="hq-select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} aria-label="Status">
          <option value="">Any status</option>
          {['pending', 'completed', 'refunded', 'failed'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="hq-select" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })} aria-label="Method">
          <option value="">Any method</option>
          {Object.entries(METHOD).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <ErrorNote error={error} onRetry={reload} />
      {!data && !error && <Loading />}
      {data && (
        <div className="hq-table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
          <table className="hq-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Booking</th>
                <th>Guest</th>
                <th>Method</th>
                <th className="hq-num">Amount</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="hq-empty">No payments match.</td>
                </tr>
              )}
              {data.map((p) => (
                <tr key={p.id}>
                  <td className="sub" style={{ fontSize: 13 }}>{day(p.paidAt || p.createdAt)}</td>
                  <td>
                    {p.bookingNumber}
                    <div className="sub">{p.unit ? `Unit ${p.unit}` : ''}{p.checkIn ? ` · arrives ${day(p.checkIn)}` : ''}</div>
                  </td>
                  <td>
                    {p.guestName}
                    <div className="sub">{p.guestEmail}</div>
                  </td>
                  <td>
                    {METHOD[p.method] || p.method}
                    {p.provider && <div className="sub">{p.provider === 'mtn' ? 'MTN' : 'Orange'} · {p.payerPhone}</div>}
                  </td>
                  <td className="hq-num">{money(p.amount)}</td>
                  <td>
                    <Pill>{p.status}</Pill>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {p.status === 'pending' && p.method !== 'stripe' && can('finance', 'approve') && (
                      <button type="button" className="btn-gold" style={{ display: 'inline-flex', padding: '7px 12px', fontSize: 13 }} disabled={busy === p.id} onClick={() => markReceived(p)}>
                        Mark received
                      </button>
                    )}
                    {p.status === 'completed' && (
                      <button type="button" className="fay-btn-outline" style={{ display: 'inline-flex', padding: '7px 12px', fontSize: 13 }} onClick={() => setRefund(p)}>
                        Request refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <RefundDialog payment={refund} onClose={() => setRefund(null)} />
    </div>
  );
}

function RefundDialog({ payment, onClose }) {
  const toast = useToast();
  const { refreshCounts } = useHq();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!payment) return null;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await hqApi.raiseApproval({
        type: 'refund',
        title: `Refund ${payment.bookingNumber} — ${payment.guestName}`,
        detail: reason,
        amount: amount ? Number(amount) : payment.amount,
        referenceType: 'payment',
        referenceId: payment.id,
      });
      toast('Refund request sent to Approvals');
      refreshCounts();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      title="Request a refund"
      subtitle={`${payment.bookingNumber} · ${money(payment.amount)} paid by ${payment.guestName}. The refund happens when it is approved, and the booking is cancelled.`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="stack">
        <label className="hq-label">
          Amount to refund (XAF) — leave empty for the full amount
          <input className="hq-input" type="number" min="1" max={payment.amount} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(payment.amount)} />
        </label>
        <label className="hq-label">
          Reason
          <textarea className="hq-input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="fay-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-gold" disabled={busy}>Send for approval</button>
        </div>
      </form>
    </Dialog>
  );
}
