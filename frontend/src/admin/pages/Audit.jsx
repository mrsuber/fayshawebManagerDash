import { useState } from 'react';
import { hqApi } from '../api';
import { ErrorNote, Loading, Tabs, useLoad, when } from '../components/parts';

const AREA_LABEL = { manager: 'FAY OS', admin: 'HQ', bookings: 'Bookings', payments: 'Payments', apartments: 'Residences', users: 'Accounts', pages: 'Website', employees: 'HR', leave: 'HR', attendance: 'HR', jobs: 'HR', feedback: 'Feedback', wellness: 'Wellness', 'deposit-box': 'Deposit boxes', auth: 'Account' };
const PAGE = 50;

export default function Audit() {
  const [tab, setTab] = useState('activity');
  return (
    <>
      <Tabs tabs={[['activity', 'Changes'], ['sign-ins', 'Sign-ins']]} value={tab} onChange={setTab} />
      {tab === 'activity' ? <Activity /> : <SignIns />}
    </>
  );
}

function Activity() {
  const [f, setF] = useState({ q: '', area: '', from: '', to: '', viewAs: false });
  const [offset, setOffset] = useState(0);
  const { data, error, loading, reload } = useLoad(
    () => hqApi.audit({ ...f, viewAs: f.viewAs ? 'true' : '', limit: PAGE, offset }),
    [f.q, f.area, f.from, f.to, f.viewAs, offset],
  );
  const set = (patch) => {
    setOffset(0);
    setF({ ...f, ...patch });
  };

  return (
    <div className="stack">
      <div className="hq-toolbar">
        <input className="hq-input" placeholder="Search who or what" value={f.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search the audit log" style={{ minWidth: 220 }} />
        <select className="hq-select" value={f.area} onChange={(e) => set({ area: e.target.value })} aria-label="Area">
          <option value="">Every area</option>
          {(data?.areas || []).map((a) => (
            <option key={a} value={a}>{AREA_LABEL[a] || a}</option>
          ))}
        </select>
        <label className="hq-toolbar sub">
          From <input className="hq-input" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} style={{ colorScheme: 'dark' }} />
        </label>
        <label className="hq-toolbar sub">
          to <input className="hq-input" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} style={{ colorScheme: 'dark' }} />
        </label>
        <label className="hq-toolbar" style={{ fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.viewAs} onChange={(e) => set({ viewAs: e.target.checked })} style={{ accentColor: 'var(--gold)', width: 18, height: 18 }} /> View-as sessions only
        </label>
      </div>
      <ErrorNote error={error} onRetry={reload} />
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="hq-table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
            <table className="hq-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Where</th>
                  <th>What</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="hq-empty">No changes match.</td>
                  </tr>
                )}
                {data.items.map((i) => (
                  <tr key={i.id}>
                    <td className="sub" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{when(i.createdAt)}</td>
                    <td>
                      {i.actorName || 'Deleted user'}
                      <div className="sub">{i.actorRole}{i.viewAsBy ? ` · view-as by ${i.viewAsBy}` : ''}</div>
                    </td>
                    <td>
                      <span className="hq-pill">{AREA_LABEL[i.area] || i.area}</span>
                    </td>
                    <td>
                      {i.summary}
                      <div className="sub" style={{ fontFamily: 'monospace', fontSize: 11 }}>{i.method} {i.path}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="hq-toolbar" style={{ justifyContent: 'space-between' }}>
            <span className="sub">
              {data.total ? `${offset + 1}–${Math.min(offset + PAGE, data.total)} of ${data.total}` : '0 changes'}
            </span>
            <span className="hq-toolbar">
              <button type="button" className="fay-btn-outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Newer</button>
              <button type="button" className="fay-btn-outline" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Older</button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function SignIns() {
  const { data, error, reload } = useLoad(() => hqApi.signIns(), []);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <div className="hq-table-wrap">
      <table className="hq-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Result</th>
            <th>From</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={4} className="hq-empty">No sign-ins recorded yet.</td>
            </tr>
          )}
          {data.map((s) => (
            <tr key={s.id}>
              <td className="sub" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{when(s.at)}</td>
              <td>
                {s.name || s.email || 'Unknown account'}
                <div className="sub">{s.role}</div>
              </td>
              <td>{s.success ? <span className="hq-pill hq-pill--green">signed in</span> : <span className="hq-pill hq-pill--red">{s.reason || 'failed'}</span>}</td>
              <td className="sub" style={{ fontSize: 12 }}>
                {s.ip}
                <div style={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.userAgent}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
