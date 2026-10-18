import { Link } from 'react-router-dom';
import { Card, Icon } from '../../manager/components/ui';
import { hqApi } from '../api';
import { DailyBars, ErrorNote, HBars, Loading, Stat, money, useHq, useLoad, when } from '../components/parts';

const STREAM_LABELS = { stays: 'Stays', dining: 'Dining', wellness: 'Wellness', experiences: 'Experiences', other: 'Other services' };
const LEVEL = { danger: 'var(--red-soft)', warning: 'var(--gold)', info: 'var(--blue-soft)' };

/** Alert targets: an HQ page, a FAY OS page (manager:<page>) or a v1 page inside HQ (legacy:<page>). */
function alertLink(to) {
  if (!to) return null;
  if (to.startsWith('manager:')) return `/manager/${to.slice(8)}`;
  if (to.startsWith('legacy:')) return `/admin/${to.slice(7)}`;
  return `/admin/${to}`;
}

export default function Overview() {
  const { property, me } = useHq();
  const { data, error, loading, reload } = useLoad(() => hqApi.overview(property), [property]);

  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const d = data;
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="stack" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
      <p className="serif" style={{ margin: '0 0 4px', fontSize: 22, color: 'var(--text-3)' }}>
        {greeting}, {me.user.name?.split(' ')[0]}. Here is Faysha today.
      </p>

      <div className="hq-stats">
        <Stat hero icon="payments" label="Earned today" value={money(d.revenue.today)} sub="stays and services" />
        <Stat icon="calendar_month" label="Earned this month" value={money(d.revenue.mtd)} trend={d.revenue.mtdChange} sub={d.revenue.mtdChange != null ? 'vs same days last month' : 'first month on record'} />
        <Stat icon="hotel" label="Occupied tonight" value={`${d.stays.occupancy}%`} sub={`${d.stays.inHouse} of ${d.stays.units} residences`} />
        <Stat icon="flight_land" label="Arrivals · departures" value={`${d.stays.arrivals} · ${d.stays.departures}`} sub="today" />
        <Stat icon="approval" label="Waiting for you" value={d.approvals.pending} sub={d.approvals.leave ? `${d.approvals.leave} leave request${d.approvals.leave > 1 ? 's' : ''}` : 'decisions'} />
        <Stat icon="phone_iphone" label="Mobile money to confirm" value={d.mobileMoney.count} sub={d.mobileMoney.count ? money(d.mobileMoney.amount) : 'all settled'} />
      </div>

      <div className="grid-cols" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
        <Card title="Revenue earned, last 14 days" aside={<Link to="/admin/finance" className="card-link">Finance ›</Link>}>
          <DailyBars rows={d.revenue.trend} detail={(r) => `Stays ${money(r.stays)} · Services ${money(r.total - r.stays)}`} />
        </Card>
        <Card title="This month by stream">
          <HBars items={Object.entries(STREAM_LABELS).map(([k, label]) => ({ label, value: d.revenue.streams[k] || 0 })).filter((i) => i.value > 0)} />
          <span className="sub">Stays are counted per night stayed; services on the day they happen.</span>
        </Card>
      </div>

      <div className="grid-cols">
        <Card title="Needs your attention">
          {d.alerts.length === 0 ? (
            <div className="hq-empty" style={{ padding: 20 }}>
              <Icon name="verified" color="var(--green-bright)" /> Nothing needs you right now.
            </div>
          ) : (
            d.alerts.map((a) => {
              const href = alertLink(a.to);
              const row = (
                <span style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-soft)', color: 'var(--text)' }}>
                  <Icon name={a.icon} size={22} color={LEVEL[a.level]} />
                  <span style={{ flex: 1 }}>{a.text}</span>
                  {href && <Icon name="chevron_right" size={20} color="var(--muted)" />}
                </span>
              );
              return href ? (
                <Link key={a.text} to={href} className="hov-row">
                  {row}
                </Link>
              ) : (
                <div key={a.text}>{row}</div>
              );
            })
          )}
        </Card>

        <Card title="Teams on duty" aside={<Link to="/admin/staff" className="card-link">Staff ›</Link>}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div className="kpi-n">{d.staff.total}</div>
              <div className="kpi-l">active staff</div>
            </div>
            <div>
              <div className="kpi-n">{d.staff.onLeaveToday}</div>
              <div className="kpi-l">on leave today</div>
            </div>
          </div>
          <HBars items={d.staff.byDepartment.map((x) => ({ label: x.department, value: x.count }))} format={(n) => String(n)} />
        </Card>

        <Card title="Operations" aside={['superadmin', 'manager'].includes(me.user.role) ? <Link to="/manager/requests" className="card-link">FAY OS ›</Link> : null}>
          {[
            ['room_service', 'Open guest requests', d.operations.openRequests],
            ['priority_high', 'Urgent requests', d.operations.urgentRequests],
            ['build', 'Maintenance alerts', d.operations.maintenanceAlerts],
          ].map(([icon, label, n]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
              <Icon name={icon} size={22} color="var(--gold)" />
              <span style={{ flex: 1 }}>{label}</span>
              <span className="serif" style={{ fontSize: 24, fontWeight: 600 }}>{n}</span>
            </div>
          ))}
        </Card>
      </div>

      {me.areas.includes('audit') && (
        <Card title="Latest changes" aside={<Link to="/admin/audit" className="card-link">Audit log ›</Link>}>
          {d.recentActivity.length === 0 ? (
            <div className="hq-empty" style={{ padding: 20 }}>No changes recorded yet.</div>
          ) : (
            d.recentActivity.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid var(--border-soft)', flexWrap: 'wrap' }}>
                <span className="sub" style={{ minWidth: 120 }}>{when(r.createdAt)}</span>
                <span style={{ fontWeight: 500 }}>{r.actorName}</span>
                <span style={{ color: 'var(--text-3)', flex: 1 }}>{r.summary}</span>
                {r.impersonatedBy && <span className="hq-pill hq-pill--gold">view-as</span>}
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}
