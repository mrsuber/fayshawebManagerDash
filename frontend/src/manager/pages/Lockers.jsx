import moment from 'moment';
import { useState } from 'react';
import { opsApi } from '../api';
import FormDialog from '../components/FormDialog';
import { Empty, Pill, Tabs, Toolbar } from '../components/kit';
import { Icon, KpiGrid } from '../components/ui';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useGuestOptions from '../hooks/useGuestOptions';
import useSocketEvent from '../hooks/useSocketEvent';
import { money } from './guest360/format';

export const LOAN_CATEGORIES = [
  ['locker', 'Extra locker'],
  ['golf', 'Golf clubs & balls'],
  ['sport', 'Sport equipment'],
  ['beach', 'Pool & beach kit'],
  ['kids', 'For children'],
  ['other', 'Other'],
];
const catLabel = (c) => LOAN_CATEGORIES.find(([k]) => k === c)?.[1] || c;
const STATUS = { requested: ['Requested', '#e8b84a'], ready: ['Ready', '#5b8ff0'], out: ['With the guest', '#3fd283'], returned: ['Returned', '#8f897d'], cancelled: ['Cancelled', '#8f897d'], declined: ['Declined', '#d94040'], lost: ['Lost', '#d94040'] };
const ITEM_STATUS = { available: ['Available', '#3fd283'], on_loan: ['On loan', '#5b8ff0'], maintenance: ['Maintenance', '#e8b84a'], retired: ['Retired', '#8f897d'] };

/** Extra lockers and equipment lent to guests (golf, sport, beach…): requests from the app, hand-over, return. */
export default function Lockers() {
  const toast = useToast();
  const [tab, setTab] = useState('open');
  const loansQ = useApi(() => opsApi.loans(tab === 'history' ? 'all' : 'open'), [tab], []);
  const itemsQ = useApi(opsApi.loanItems, [], []);
  const { options: guestOptions } = useGuestOptions();
  const [dialog, setDialog] = useState(null);
  const reload = () => {
    loansQ.reload();
    itemsQ.reload();
  };
  useSocketEvent('loan:updated', reload);

  const act = (id, action, body, message) =>
    opsApi
      .loanAction(id, action, body)
      .then(() => {
        reload();
        toast(message);
      })
      .catch((e) => toast(e.message, 'error'));

  const loans = loansQ.data || [];
  const items = itemsQ.data || [];
  const overdue = loans.filter((l) => l.overdue).length;
  const kpis = [
    { icon: 'pending_actions', c: '#e8b84a', n: loans.filter((l) => l.status === 'requested').length, l: 'To prepare' },
    { icon: 'outbound', c: '#3fd283', n: loans.filter((l) => ['ready', 'out'].includes(l.status)).length, l: 'With guests' },
    { icon: 'schedule', c: '#ff6b6b', n: overdue, l: 'Overdue', dc: '#ff6b6b' },
    { icon: 'inventory_2', c: '#5b8ff0', n: `${items.filter((i) => i.status === 'available').length}/${items.filter((i) => i.status !== 'retired').length}`, l: 'Items free' },
  ];

  const loanRows = (
    <section className="card kit-scroll" style={{ padding: 6 }}>
      {loans.length === 0 && !loansQ.loading ? <Empty icon="lock" title={tab === 'open' ? 'Nothing out right now' : 'No history yet'}>Guests ask for extra lockers and equipment from the app; you can also lend at the desk.</Empty> : null}
      {loans.length ? (
        <table className="kit-table" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th>Guest</th>
              <th>What</th>
              <th>Item</th>
              <th>Code</th>
              <th>Due back</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.guestName}
                  <div className="sub">{l.reference}{l.reason ? ` · ${l.reason}` : ''}</div>
                </td>
                <td>{catLabel(l.category)}</td>
                <td>{l.item ? `${l.item.code} · ${l.item.name}` : '—'}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace' }}>{l.category === 'locker' ? l.pin : '—'}</td>
                <td style={{ color: l.overdue ? 'var(--red-soft)' : undefined }}>{moment(l.dueAt).format('ddd D MMM, HH:mm')}</td>
                <td><Pill tone={l.overdue ? '#ff6b6b' : STATUS[l.status][1]}>{l.overdue ? 'Overdue' : STATUS[l.status][0]}</Pill></td>
                <td>
                  <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
                    {l.status === 'requested' ? (
                      <>
                        <select
                          className="kit-select"
                          defaultValue=""
                          onChange={(e) => e.target.value && act(l.id, 'assign', { itemId: e.target.value === 'auto' ? null : Number(e.target.value) }, 'Assigned — the guest can see it in the app')}
                          aria-label="Assign an item"
                        >
                          <option value="">Assign…</option>
                          <option value="auto">First free</option>
                          {items.filter((i) => i.category === l.category && i.status === 'available').map((i) => (
                            <option key={i.id} value={i.id}>{i.code} · {i.name}</option>
                          ))}
                        </select>
                        <button type="button" className="fay-btn-outline" onClick={() => { const reason = window.prompt('Why? (sent to the guest)'); if (reason !== null) act(l.id, 'decline', { reason }, 'Declined'); }}>Decline</button>
                      </>
                    ) : null}
                    {l.status === 'ready' ? <button type="button" className="btn-gold" onClick={() => act(l.id, 'out', {}, 'Handed over')}>Handed over</button> : null}
                    {['ready', 'out'].includes(l.status) ? (
                      <>
                        <button type="button" className="fay-btn-outline" onClick={() => { const condition = window.prompt('Condition on return (optional)'); if (condition !== null) act(l.id, 'return', { condition, damaged: /damag|broken|missing/i.test(condition) }, 'Returned'); }}>Returned</button>
                        <button type="button" className="fay-btn-outline" onClick={() => act(l.id, 'extend', { hours: 24 }, 'Extended by 24 h')}>+24 h</button>
                        <button type="button" className="fay-btn-outline" onClick={() => window.confirm('Mark as lost? The item is retired.') && act(l.id, 'lost', {}, 'Marked lost')}>Lost</button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );

  const inventory = (
    <section className="card kit-scroll" style={{ padding: 6 }}>
      {items.length === 0 && !itemsQ.loading ? <Empty icon="inventory_2" title="No items yet">Add each locker and each set of equipment you lend, with a code (L-12, GOLF-03).</Empty> : null}
      {items.length ? (
        <table className="kit-table" style={{ minWidth: 760 }}>
          <thead>
            <tr><th>Code</th><th>Item</th><th>Category</th><th>Where</th><th>Loan length</th><th>Deposit</th><th>Status</th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="clickable" onClick={() => setDialog({ item: i })}>
                <td style={{ fontFamily: 'ui-monospace, monospace' }}>{i.code}</td>
                <td>{i.name}{i.holder ? <div className="sub">with {i.holder} until {moment(i.dueAt).format('D MMM HH:mm')}</div> : null}</td>
                <td>{catLabel(i.category)}</td>
                <td>{i.location || '—'}</td>
                <td>{i.defaultHours} h</td>
                <td>{i.deposit ? money(i.deposit) : '—'}</td>
                <td><Pill tone={ITEM_STATUS[i.status][1]}>{ITEM_STATUS[i.status][0]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );

  return (
    <div className="stack">
      <KpiGrid items={kpis} min={170} />
      <Toolbar
        right={
          <>
            <button type="button" className="fay-btn-outline" onClick={() => setDialog({ loan: true })}><Icon name="add" size={18} /> Lend at the desk</button>
            <button type="button" className="btn-gold" onClick={() => setDialog({ item: {} })}><Icon name="add_box" size={18} /> Add an item</button>
          </>
        }
      >
        <Tabs value={tab} onChange={setTab} options={[['open', 'Open', loans.length && tab === 'open' ? loans.length : undefined], ['inventory', 'Inventory', items.length], ['history', 'History']]} />
      </Toolbar>
      {tab === 'inventory' ? inventory : loanRows}

      <FormDialog
        open={!!dialog?.item}
        title={dialog?.item?.id ? `Edit ${dialog.item.code}` : 'Add an item'}
        submitLabel="Save"
        fields={[
          { name: 'code', label: 'Code', required: true, helperText: 'Written on the item: L-12, GOLF-03' },
          { name: 'name', label: 'Name', required: true, helperText: 'e.g. Extra locker (large), Golf set + 20 balls' },
          { name: 'category', label: 'Category', type: 'select', options: LOAN_CATEGORIES },
          { name: 'location', label: 'Where it is' },
          { name: 'defaultHours', label: 'Standard loan length (hours)', type: 'number' },
          { name: 'deposit', label: 'Deposit', type: 'number' },
          ...(dialog?.item?.id ? [{ name: 'status', label: 'Status', type: 'select', options: ['available', 'maintenance', 'retired'] }] : []),
          { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
        ]}
        initial={dialog?.item?.id ? { ...dialog.item, status: dialog.item.status === 'on_loan' ? 'available' : dialog.item.status } : { category: 'locker', defaultHours: 24, deposit: 0 }}
        onSubmit={(v) => (dialog.item.id ? opsApi.updateItem(dialog.item.id, v) : opsApi.createItem(v)).then(() => { itemsQ.reload(); toast('Saved'); })}
        onClose={() => setDialog(null)}
      />
      <FormDialog
        open={!!dialog?.loan}
        title="Lend at the desk"
        submitLabel="Lend"
        fields={[
          { name: 'userId', label: 'Guest', type: 'select', options: guestOptions },
          { name: 'category', label: 'What', type: 'select', options: LOAN_CATEGORIES },
          { name: 'hours', label: 'For how long (hours)', type: 'number' },
          { name: 'reason', label: 'Note', type: 'textarea', rows: 2 },
        ]}
        initial={{ category: 'locker', hours: 24, userId: guestOptions[0]?.[0] || '' }}
        onSubmit={(v) => opsApi.createLoan({ ...v, itemId: null }).then(() => { reload(); toast('Lent — an item was assigned'); })}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
