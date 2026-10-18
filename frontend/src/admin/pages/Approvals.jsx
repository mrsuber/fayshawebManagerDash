import { useState } from 'react';
import { Icon } from '../../manager/components/ui';
import { useToast } from '../../manager/context/ToastContext';
import { hqApi } from '../api';
import { Dialog, ErrorNote, Loading, Pill, Tabs, money, useHq, useLoad, when } from '../components/parts';

const TYPE = {
  refund: ['currency_exchange', 'Refund'],
  discount: ['sell', 'Discount'],
  expense: ['receipt_long', 'Expense'],
  purchase: ['shopping_cart', 'Purchase'],
  leave: ['beach_access', 'Leave'],
  other: ['help', 'Other'],
};

export default function Approvals() {
  const { can, refreshCounts } = useHq();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [decision, setDecision] = useState(null); // { item, decision }
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useLoad(() => hqApi.approvals(status), [status]);
  const canDecide = can('approvals', 'approve');

  const done = () => {
    reload();
    refreshCounts();
  };

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <Tabs tabs={[['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'Everything']]} value={status} onChange={setStatus} />
        </div>
        <button type="button" className="btn-gold" onClick={() => setCreating(true)} style={{ marginBottom: 16 }}>
          <Icon name="add" size={18} /> New request
        </button>
      </div>
      <ErrorNote error={error} onRetry={reload} />
      {!data && !error && <Loading />}
      {data && data.length === 0 && (
        <div className="card hq-empty">
          <Icon name="task_alt" size={30} color="var(--green-bright)" />
          <div style={{ marginTop: 8 }}>{status === 'pending' ? 'Nothing is waiting for a decision.' : 'Nothing here yet.'}</div>
        </div>
      )}
      <div className="stack" style={{ opacity: loading ? 0.6 : 1 }}>
        {data?.map((a) => {
          const [icon, label] = TYPE[a.type] || TYPE.other;
          return (
            <article key={a.id} className="card" style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <span style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(232,184,74,.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={icon} size={24} color="var(--gold)" />
              </span>
              <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="hq-pill hq-pill--gold">{label}</span>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>{a.title}</span>
                  {a.status !== 'pending' && <Pill>{a.status}</Pill>}
                </div>
                {a.detail && <div style={{ color: 'var(--text-3)', fontSize: 14, lineHeight: 1.55 }}>{a.detail}</div>}
                <div className="sub">
                  Requested by {a.requestedBy || 'someone'} · {when(a.requestedAt)}
                  {a.decidedBy && ` · ${a.status} by ${a.decidedBy} ${when(a.decidedAt)}`}
                  {a.note && ` — “${a.note}”`}
                </div>
              </div>
              {a.amount != null && (
                <div className="serif" style={{ fontSize: 26, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {money(a.amount, a.currency || 'XAF')}
                </div>
              )}
              {a.status === 'pending' && canDecide && (
                <div style={{ display: 'flex', gap: 8, alignSelf: 'center' }}>
                  <button type="button" className="fay-btn-outline hq-danger" onClick={() => setDecision({ item: a, decision: 'rejected' })}>
                    Reject
                  </button>
                  <button type="button" className="btn-gold" onClick={() => setDecision({ item: a, decision: 'approved' })}>
                    Approve
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <DecideDialog state={decision} onClose={() => setDecision(null)} onDone={done} toast={toast} />
      <NewRequestDialog open={creating} onClose={() => setCreating(false)} onDone={done} toast={toast} />
    </div>
  );
}

function DecideDialog({ state, onClose, onDone, toast }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const { item, decision } = state;
  const approve = decision === 'approved';
  const consequence = approve
    ? item.type === 'refund'
      ? 'The payment is refunded now (through Stripe for card payments) and the booking is cancelled.'
      : item.type === 'leave'
        ? 'The leave is approved, the balance is updated and the employee is notified.'
        : 'The request is marked approved.'
    : 'The requester sees your reason.';
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await hqApi.decide(item.id, decision, note);
      toast(approve ? 'Approved' : 'Rejected');
      setNote('');
      onDone();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open title={approve ? 'Approve this request?' : 'Reject this request?'} subtitle={`${item.title}${item.amount != null ? ` · ${money(item.amount)}` : ''}`} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <p style={{ margin: 0, color: 'var(--text-3)' }}>{consequence}</p>
        <label className="hq-label">
          {approve ? 'Note (optional)' : 'Reason'}
          <textarea className="hq-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} required={!approve} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="fay-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className={approve ? 'btn-gold' : 'fay-btn-outline hq-danger'} disabled={busy}>
            {busy ? 'Working…' : approve ? 'Approve' : 'Reject'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function NewRequestDialog({ open, onClose, onDone, toast }) {
  const [form, setForm] = useState({ type: 'expense', title: '', detail: '', amount: '' });
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await hqApi.raiseApproval({ ...form, amount: form.amount ? Number(form.amount) : null });
      toast('Request added');
      setForm({ type: 'expense', title: '', detail: '', amount: '' });
      onDone();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open title="New request" subtitle="Record a spending or discount decision. Refunds are requested from Finance → Payments; leave from HR." onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="hq-form-grid">
          <label className="hq-label">
            Type
            <select className="hq-select" value={form.type} onChange={set('type')}>
              <option value="expense">Expense</option>
              <option value="purchase">Purchase</option>
              <option value="discount">Discount</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="hq-label">
            Amount (XAF)
            <input className="hq-input" type="number" min="0" value={form.amount} onChange={set('amount')} />
          </label>
        </div>
        <label className="hq-label">
          What is it for?
          <input className="hq-input" value={form.title} onChange={set('title')} required maxLength={200} placeholder="e.g. Replace pool pump" />
        </label>
        <label className="hq-label">
          Details
          <textarea className="hq-input" rows={3} value={form.detail} onChange={set('detail')} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="fay-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-gold" disabled={busy}>Add request</button>
        </div>
      </form>
    </Dialog>
  );
}
