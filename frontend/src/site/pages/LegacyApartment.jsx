import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { getUnit } from '../api';
import { Loading } from '../components/ui';

/** v1 links (/apartments/:id, e.g. in old emails) → the residence page of that unit's category. */
export default function LegacyApartment() {
  const { id } = useParams();
  const [to, setTo] = useState(null);
  useEffect(() => {
    getUnit(id)
      .then((u) => setTo(u ? `/residences/${u.categoryId}` : '/residences'))
      .catch(() => setTo('/residences'));
  }, [id]);
  return to ? <Navigate to={to} replace /> : <Loading />;
}
