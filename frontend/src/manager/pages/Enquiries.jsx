import moment from 'moment';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { enquiriesApi } from '../api';
import { Ago, Composer, Empty, Facts, ListRow, Pill, SearchBox, SplitView, Tabs, Thread, Toolbar } from '../components/kit';
import { Icon } from '../components/ui';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useCollection from '../hooks/useCollection';
import useNav from '../hooks/useNav';
import useSocketEvent from '../hooks/useSocketEvent';

const STATUS_TONE = { New: '#e8b84a', Open: '#5b8ff0', Replied: '#3fd283', Closed: '#8f897d', Spam: '#d94040' };
const TABS = ['New', 'Open', 'Replied', 'Closed'];

/** Enquiries from the website contact form: read, assign, note, reply by email, close. */
export default function Enquiries() {
  const toast = useToast();
  const navigate = useNav();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const selectedId = params.get('id') ? Number(params.get('id')) : null;
  const select = (id) => setParams(id ? { id: String(id) } : {});

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const listQ = useApi(() => enquiriesApi.list({ status: tab || undefined, q: debounced || undefined }), [tab, debounced], { items: [], counts: {} });
  const detailQ = useApi(() => (selectedId ? enquiriesApi.get(selectedId) : Promise.resolve(null)), [selectedId], null);
  const team = useCollection('team');
  const items = listQ.data?.items || [];
  const counts = listQ.data?.counts || {};
  const cur = detailQ.data;

  // Opening a New enquiry marks it Open.
  useEffect(() => {
    if (cur && cur.status === 'New') {
      enquiriesApi.update(cur.id, {}).then(apply).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id]);

  const apply = (e) => {
    if (!e) return;
    detailQ.setData((d) => (d && d.id === e.id ? e : d));
    listQ.setData((d) => ({ ...d, items: (d?.items || []).map((x) => (x.id === e.id ? { ...x, ...e } : x)) }));
  };

  useSocketEvent('enquiry:created', () => listQ.reload());
  useSocketEvent('enquiry:updated', apply);

  const act = (promise, message) =>
    promise
      .then((e) => {
        apply(e);
        listQ.reload();
        if (message) toast(message);
      })
      .catch((e) => toast(e.message, 'error'));

  const total = Object.entries(counts).filter(([k]) => k !== 'Spam').reduce((s, [, n]) => s + n, 0);

  const list = (
    <>
      {items.length === 0 && !listQ.loading ? (
        <Empty icon="inbox" title={debounced ? 'Nothing matches' : 'No enquiries here'}>
          Messages sent from the website contact form land here for follow-up.
        </Empty>
      ) : null}
      {items.map((e) => (
        <ListRow
          key={e.id}
          active={e.id === selectedId}
          unread={e.status === 'New'}
          onClick={() => select(e.id)}
          title={e.name}
          meta={e.subject || e.message}
          aside={
            <>
              <Ago at={e.createdAt} />
              <Pill tone={STATUS_TONE[e.status]}>{e.status}</Pill>
            </>
          }
        />
      ))}
    </>
  );

  const detail = !cur ? (
    <Empty icon="mark_email_unread" title="Select an enquiry">
      Reply by email from here: the guest receives a Faysha-styled email, and the reply is kept on file with the enquiry.
    </Empty>
  ) : (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="col" style={{ flex: 1, minWidth: 220, gap: 6 }}>
          <span className="kit-label">{cur.source === 'app' ? 'From the app' : 'From the website'} · {moment(cur.createdAt).format('ddd D MMM YYYY, HH:mm')}</span>
          <h2 className="kit-h">{cur.subject || 'General enquiry'}</h2>
        </div>
        <Pill tone={STATUS_TONE[cur.status]}>{cur.status}</Pill>
      </div>
      <Facts
        items={[
          ['From', cur.name],
          ['Email', <a href={`mailto:${cur.email}`}>{cur.email}</a>],
          ['Phone', cur.phone ? <a href={`tel:${cur.phone.replace(/\s/g, '')}`}>{cur.phone}</a> : null],
          ['Guest account', cur.guestId ? <button type="button" className="card-link" onClick={() => navigate(`/guest360?guest=${cur.guestId}`)}>Open Guest 360</button> : 'None'],
          ['First response', cur.firstResponseAt ? moment(cur.firstResponseAt).from(moment(cur.createdAt), true) : 'Not yet'],
        ]}
      />
      <div className="kit-message">{cur.message}</div>

      <div className="kit-actions">
        <select
          className="kit-select"
          value={cur.assignedTo || ''}
          onChange={(e) => act(enquiriesApi.update(cur.id, { assignedTo: e.target.value ? Number(e.target.value) : null }), 'Assignment updated')}
          aria-label="Assigned to"
        >
          <option value="">Unassigned</option>
          {team.items.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {cur.status !== 'Closed' ? (
          <button type="button" className="fay-btn-outline" onClick={() => act(enquiriesApi.update(cur.id, { status: 'Closed' }), 'Enquiry closed')}>
            <Icon name="task_alt" size={18} /> Close
          </button>
        ) : (
          <button type="button" className="fay-btn-outline" onClick={() => act(enquiriesApi.update(cur.id, { status: 'Open' }), 'Enquiry reopened')}>
            <Icon name="undo" size={18} /> Reopen
          </button>
        )}
        {cur.status !== 'Spam' ? (
          <button type="button" className="fay-btn-outline" onClick={() => act(enquiriesApi.update(cur.id, { status: 'Spam' }), 'Marked as spam')}>
            <Icon name="report" size={18} /> Spam
          </button>
        ) : null}
      </div>

      <Thread items={cur.thread} />

      <Composer
        placeholder={`Write to ${cur.name.split(' ')[0]}, or leave an internal note for the team…`}
        actions={[
          { label: 'Internal note', icon: 'sticky_note_2', onSend: (body) => enquiriesApi.note(cur.id, body).then(apply) },
          { label: 'Send reply', icon: 'send', primary: true, onSend: (body) => enquiriesApi.reply(cur.id, body).then((e) => { apply(e); listQ.reload(); toast(`Reply sent to ${cur.email}`); }) },
        ]}
      />
    </>
  );

  return (
    <div className="stack">
      <Toolbar right={<SearchBox value={q} onChange={setQ} placeholder="Search name, email, message…" style={{ width: 300, maxWidth: '100%' }} />}>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[['', 'All', total], ...TABS.map((s) => [s, s, counts[s] || 0]), ['Spam', 'Spam', counts.Spam || 0]]}
        />
      </Toolbar>
      <SplitView list={list} detail={detail} hasSelection={!!selectedId} onBack={() => select(null)} />
    </div>
  );
}
