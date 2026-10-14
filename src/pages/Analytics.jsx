import moment from 'moment';
import { useState } from 'react';
import { analyticsApi } from '../api';
import FormDialog from '../components/FormDialog';
import { Bar, Card, Chip, Donut, Icon, conic } from '../components/ui';
import ViewAllDialog from '../components/ViewAllDialog';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import { money } from './guest360/format';

const RANGES = ['7 days', '30 days', 'Year to date', 'Custom'];
const rangeDates = (i, custom) => {
  const to = moment().format('YYYY-MM-DD');
  if (i === 0) return [moment().subtract(6, 'days').format('YYYY-MM-DD'), to];
  if (i === 1) return [moment().subtract(29, 'days').format('YYYY-MM-DD'), to];
  if (i === 2) return [moment().startOf('year').format('YYYY-MM-DD'), to];
  return custom;
};
const short = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1000)}K`);

function LegendSwatch({ c, children }) {
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
      {children}
    </span>
  );
}

export default function Analytics() {
  const toast = useToast();
  const [range, setRange] = useState(2);
  const [custom, setCustom] = useState([moment().subtract(13, 'days').format('YYYY-MM-DD'), moment().format('YYYY-MM-DD')]);
  const [picking, setPicking] = useState(false);
  const [topOpen, setTopOpen] = useState(false);
  const [from, to] = rangeDates(range, custom);
  const { data: r } = useApi(() => analyticsApi.report(from, to), [from, to]);

  const exportCsv = () => {
    if (!r) return;
    const lines = [
      `FAY OS analytics,${from},${to}`,
      '',
      'KPI,Value',
      ...r.kpis.map((k) => `${k.l},"${k.format === 'money' ? money(k.n) : k.n}"`),
      '',
      'Period,Stays revenue,Services revenue',
      ...r.series.map((s) => `${s.label},${s.stays},${s.services}`),
      '',
      'Service,Volume,Revenue',
      ...r.topServices.map((s) => `${s.n},${s.count},${s.revenue}`),
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `fay-analytics-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Report exported');
  };

  if (!r) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading analytics…</div>;
  const max = Math.max(1, ...r.series.map((s) => s.stays + s.services));
  const topRow = (s, i) => (
    <div key={s.n} className="row-line" style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto auto', gap: 12, alignItems: 'center', padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--gold)' }}>{i + 1}</span>
      <span>{s.n}</span>
      <span style={{ color: 'var(--muted)' }}>{s.count}</span>
      <span>{money(s.revenue)}</span>
    </div>
  );

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="sub" style={{ marginRight: 'auto' }}>
          {moment(from).format('MMM D, YYYY')} – {moment(to).format('MMM D, YYYY')}
        </span>
        {RANGES.map((l, i) => (
          <Chip
            key={l}
            on={i === range}
            onClick={() => {
              if (i === 3) setPicking(true);
              else setRange(i);
            }}
            style={{ padding: '8px 16px', fontSize: 14 }}
          >
            {i === 3 && range === 3 ? `${moment(custom[0]).format('MMM D')} – ${moment(custom[1]).format('MMM D')}` : l}
          </Chip>
        ))}
        <button type="button" className="btn-outline" onClick={exportCsv} style={{ padding: '8px 14px' }}>
          <Icon name="download" size={18} />
          Export CSV
        </button>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        {r.kpis.map((k) => (
          <div key={k.l} className="card" style={{ gap: 4 }}>
            <span className="kpi-l">{k.l}</span>
            <span className="kpi-n" style={{ fontSize: 32 }}>
              {k.format === 'money' ? money(k.n) : k.n}
            </span>
            <span style={{ fontSize: 12, color: 'var(--green-bright)' }}>{k.d} vs last period</span>
          </div>
        ))}
      </div>

      <div className="grid-cols">
        <Card
          title={`Revenue by ${r.unit === 'day' ? 'Day' : r.unit === 'week' ? 'Week' : 'Month'}`}
          gap={12}
          aside={
            <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
              <LegendSwatch c="#e8b84a">Stays</LegendSwatch>
              <LegendSwatch c="#2f6fe8">Services</LegendSwatch>
            </div>
          }
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: r.series.length > 16 ? 4 : 14, height: 240, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            {r.series.map((s) => (
              <div key={s.label} className="col" title={`${s.label}: stays ${money(s.stays)} · services ${money(s.services)}`} style={{ flex: 1, justifyContent: 'flex-end', height: '100%', gap: 2 }}>
                <div style={{ borderRadius: '3px 3px 0 0', background: 'var(--blue)', height: `${(s.services / max) * 95}%` }} />
                <div style={{ background: 'var(--gold)', height: `${(s.stays / max) * 95}%` }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: r.series.length > 16 ? 4 : 14, fontSize: 11, color: 'var(--dim)' }}>
            {r.series.map((s, i) => (
              <span key={s.label} style={{ flex: 1, textAlign: 'center', visibility: r.series.length > 16 && i % 2 ? 'hidden' : 'visible' }}>
                {s.label}
              </span>
            ))}
          </div>
        </Card>

        <Card title="Revenue Mix">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Donut size={140} inner={104} gradient={conic(r.mix.map((m) => [m.c, m.v]))}>
              <span className="serif" style={{ fontSize: 24 }}>
                {short(r.total)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{RANGES[range]}</span>
            </Donut>
            <div className="col" style={{ gap: 6, fontSize: 13, flex: 1 }}>
              {r.mix.map((l) => (
                <div key={l.l} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: l.c }} />
                  <span style={{ flex: 1 }}>{l.l}</span>
                  <span style={{ color: 'var(--text-3)' }}>{l.v}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid-cols-320">
        <Card title="Occupancy by Collection" gap={8}>
          {r.occupancy.map((o) => (
            <div key={o.l} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 40px', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span>{o.l}</span>
              <Bar value={`${o.v}%`} color="var(--green-bright)" height={8} />
              <span style={{ color: 'var(--text-3)' }}>{o.v}%</span>
            </div>
          ))}
        </Card>

        <Card title="Satisfaction by Department" gap={8}>
          {r.satisfaction.map((s) => (
            <div key={s.l} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 30px', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span>{s.l}</span>
              <Bar value={`${s.v * 10}%`} color={s.c} height={8} />
              <span style={{ color: 'var(--text-3)' }}>{s.v}</span>
            </div>
          ))}
        </Card>

        <Card title="Top Services" link="View All ›" onLink={() => setTopOpen(true)} gap={4} headGap={6}>
          {r.topServices.slice(0, 5).map(topRow)}
        </Card>
      </div>

      <ViewAllDialog open={topOpen} onClose={() => setTopOpen(false)} title={`Top Services · ${RANGES[range]}`} items={r.topServices} searchText={(s) => s.n} renderItem={topRow} />
      <FormDialog
        open={picking}
        title="Custom Range"
        submitLabel="Apply"
        fields={[
          { name: 'from', label: 'From', type: 'date', required: true },
          { name: 'to', label: 'To', type: 'date', required: true },
        ]}
        initial={{ from: custom[0], to: custom[1] }}
        onSubmit={(v) => {
          if (v.to < v.from) return Promise.reject(new Error('“To” must be after “From”'));
          setCustom([v.from, v.to]);
          setRange(3);
          return Promise.resolve();
        }}
        onClose={() => setPicking(false)}
      />
    </div>
  );
}
