import { useEffect, useState } from 'react';
import api from '../api/client';

/**
 * Pick the person who does the work: the team of `department` first (least busy first), "Suggest" lets Faysha choose
 * the least busy one. onChange(id | 'auto' | null).
 */
export default function AssignPicker({ department, value, onChange, disabled, allowSuggest = true }) {
  const [people, setPeople] = useState([]);
  useEffect(() => {
    let live = true;
    api
      .get('/team/candidates', { params: { department } })
      .then((list) => live && setPeople(Array.isArray(list) ? list : list?.data || []))
      .catch(() => live && setPeople([]));
    return () => {
      live = false;
    };
  }, [department]);
  const team = people.filter((p) => p.inDepartment);
  const others = people.filter((p) => !p.inDepartment);
  const label = (p) => `${p.name}${p.jobTitle ? ` · ${p.jobTitle}` : ''} — ${p.openTasks} open${p.rating ? ` · ${p.rating}★` : ''}`;
  return (
    <select
      className="kit-input"
      style={{ padding: '7px 10px', fontSize: 13.5 }}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
      aria-label="Assign to"
    >
      <option value="">Not assigned</option>
      {allowSuggest && team.length ? <option value="auto">✦ Suggest the least busy ({department})</option> : null}
      {team.length ? (
        <optgroup label={department || 'Team'}>
          {team.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
        </optgroup>
      ) : null}
      <optgroup label="Everyone">
        {others.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
      </optgroup>
    </select>
  );
}
