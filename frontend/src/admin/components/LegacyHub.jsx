import { Suspense } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Loading, Tabs } from './parts';

/**
 * Hosts v1 administrator screens inside HQ, one tab per screen, wrapped in .hq-legacy so their light
 * Tailwind styling is mapped onto the HQ palette (see hq.css).
 */
export default function LegacyHub({ base, tabs }) {
  const { tab } = useParams();
  const navigate = useNavigate();
  const current = tabs.find((t) => t.id === tab);
  if (!current) return <Navigate to={`/admin/${base}/${tabs[0].id}`} replace />;
  const Page = current.component;
  return (
    <>
      {tabs.length > 1 && <Tabs tabs={tabs.map((t) => [t.id, t.label])} value={current.id} onChange={(id) => navigate(`/admin/${base}/${id}`)} />}
      <div className="hq-legacy">
        <Suspense fallback={<Loading />}>
          <Page />
        </Suspense>
      </div>
    </>
  );
}
