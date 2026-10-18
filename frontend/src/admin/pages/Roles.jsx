import { useEffect, useState } from 'react';
import { Card, Icon } from '../../manager/components/ui';
import { useToast } from '../../manager/context/ToastContext';
import { hqApi } from '../api';
import { Dialog, ErrorNote, Loading, useHq, useLoad } from '../components/parts';

/** HQ areas and the actions each one supports (backend/middleware/hq.js enforces them). */
const AREAS = [
  ['overview', 'Overview', 'Today’s figures, alerts and latest changes', ['view']],
  ['finance', 'Finance', 'Revenue and payments; approve = mark mobile money/cash as received', ['view', 'approve']],
  ['approvals', 'Approvals', 'Refunds, discounts, spending; approve = decide them', ['view', 'approve']],
  ['staff', 'Staff & departments', 'Team members; manage = invite, edit, deactivate, reset passwords', ['view', 'manage']],
  ['roles', 'Roles & permissions', 'This page; manage = create and change roles', ['view', 'manage']],
  ['hr', 'HR', 'Employees, recruitment, attendance; approve = decide leave', ['view', 'manage', 'approve']],
  ['properties', 'Properties', 'Faysha residences; manage = add and edit', ['view', 'manage']],
  ['website', 'Website content', 'Edit the public site', ['view', 'manage']],
  ['audit', 'Audit log', 'Who changed what, and sign-ins', ['view']],
];
const ACTIONS = [
  ['view', 'View'],
  ['manage', 'Manage'],
  ['approve', 'Approve'],
];
const AREA_KEYS = AREAS.map((a) => a[0]);

export default function Roles() {
  const { can } = useHq();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => hqApi.roles(), []);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const manage = can('roles', 'manage');

  const role = data?.find((r) => r.id === selected) || data?.find((r) => r.name !== 'superadmin' && !r.isGuest) || data?.[0];
  useEffect(() => {
    if (role) setDraft(JSON.parse(JSON.stringify(role.permissions || {})));
  }, [role]);

  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data || !role || !draft) return <Loading />;

  const locked = role.locked;
  const editable = manage && !locked && !role.isGuest;
  const checked = (area, action) => locked || draft[area]?.[action] === true;
  const toggle = (area, action) => {
    const next = { ...draft, [area]: { ...(draft[area] || {}) } };
    next[area][action] = !checked(area, action);
    // Manage or approve without view makes no sense; view off clears the rest.
    if (action !== 'view' && next[area][action]) next[area].view = true;
    if (action === 'view' && !next[area].view) {
      next[area].manage = false;
      next[area].approve = false;
    }
    setDraft(next);
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(role.permissions || {});
  const others = Object.entries(role.permissions || {}).filter(([k]) => !AREA_KEYS.includes(k));

  const save = async () => {
    setBusy(true);
    try {
      await hqApi.updateRole(role.id, { permissions: draft });
      toast(`${role.displayName} updated — members get it the next time they sign in`);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete the role “${role.displayName}”?`)) return;
    try {
      await hqApi.deleteRole(role.id);
      toast('Role deleted');
      setSelected(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="grid-cols" style={{ gridTemplateColumns: 'minmax(240px, 300px) minmax(0, 1fr)', alignItems: 'start' }}>
      <Card title="Roles" aside={manage ? <button type="button" className="card-link" onClick={() => setCreating(true)}>+ New role</button> : null} gap={4}>
        {data.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelected(r.id)}
            className="hov-row"
            aria-pressed={r.id === role.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
              background: r.id === role.id ? 'rgba(232,184,74,.12)' : 'transparent', border: `1px solid ${r.id === role.id ? 'rgba(232,184,74,.4)' : 'transparent'}`, color: 'var(--text)', font: 'inherit',
            }}
          >
            <Icon name={r.locked ? 'shield_person' : r.isGuest ? 'person' : r.system ? 'verified_user' : 'manage_accounts'} size={20} color="var(--gold)" />
            <span style={{ flex: 1 }}>
              {r.displayName}
              <span className="sub" style={{ display: 'block' }}>
                {r.members} member{r.members === 1 ? '' : 's'}{r.system ? ' · built-in' : ''}
              </span>
            </span>
          </button>
        ))}
      </Card>

      <Card
        title={role.displayName}
        aside={
          editable ? (
            <span style={{ display: 'flex', gap: 8 }}>
              {!role.system && (
                <button type="button" className="fay-btn-outline hq-danger" onClick={remove}>
                  Delete
                </button>
              )}
              <button type="button" className="fay-btn-outline" disabled={!dirty} onClick={() => setDraft(JSON.parse(JSON.stringify(role.permissions || {})))}>
                Undo
              </button>
              <button type="button" className="btn-gold" disabled={!dirty || busy} onClick={save}>
                Save changes
              </button>
            </span>
          ) : null
        }
      >
        <span style={{ color: 'var(--text-3)', fontSize: 14 }}>{role.description}</span>
        {locked && <div className="hq-pill hq-pill--gold" style={{ alignSelf: 'flex-start' }}>Super administrators always have every permission</div>}
        {role.isGuest && <div className="hq-pill" style={{ alignSelf: 'flex-start' }}>Guests use the Faysha app and never open HQ</div>}
        {role.name === 'manager' && <span className="sub">Managers work in FAY OS. Ticking an area here also opens that part of HQ to them.</span>}

        <div className="hq-table-wrap">
          <table className="hq-table hq-matrix">
            <thead>
              <tr>
                <th>HQ area</th>
                {ACTIONS.map(([k, l]) => (
                  <th key={k}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AREAS.map(([key, label, help, actions]) => (
                <tr key={key}>
                  <td>
                    <div>{label}</div>
                    <div className="sub">{help}</div>
                  </td>
                  {ACTIONS.map(([a]) => (
                    <td key={a}>
                      {actions.includes(a) ? (
                        <input
                          type="checkbox"
                          checked={checked(key, a)}
                          disabled={!editable}
                          onChange={() => toggle(key, a)}
                          aria-label={`${label}: ${a}`}
                        />
                      ) : (
                        <span className="sub" aria-hidden="true">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {others.length > 0 && (
          <details>
            <summary className="sub" style={{ cursor: 'pointer' }}>Other permissions on this role (FAY OS, apps and v1 pages)</summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {others.map(([k, v]) => (
                <span key={k} className="hq-pill">
                  {k}: {Object.entries(v || {}).filter(([, on]) => on).map(([a]) => a).join(', ') || 'none'}
                </span>
              ))}
            </div>
          </details>
        )}
      </Card>

      <NewRoleDialog
        open={creating}
        roles={data}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          reload().then(() => setSelected(id));
        }}
      />
    </div>
  );
}

function NewRoleDialog({ open, roles, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ displayName: '', name: '', description: '', copy: '' });
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'r_$1').slice(0, 40);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const base = roles.find((r) => String(r.id) === form.copy);
      const res = await hqApi.createRole({ name: form.name || slug(form.displayName), displayName: form.displayName, description: form.description, permissions: base?.permissions || {} });
      toast(`${form.displayName} created — now choose what it can do`);
      setForm({ displayName: '', name: '', description: '', copy: '' });
      onCreated(res.id);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open title="New role" subtitle="For example Finance Director, Front Office Lead or Auditor." onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="hq-label">
          Name
          <input className="hq-input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value, name: slug(e.target.value) })} required maxLength={100} />
        </label>
        <label className="hq-label">
          Key (used by the system)
          <input className="hq-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} pattern="[a-z][a-z0-9_]{2,39}" required />
        </label>
        <label className="hq-label">
          What this role is for
          <input className="hq-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label className="hq-label">
          Start from
          <select className="hq-select" value={form.copy} onChange={(e) => setForm({ ...form, copy: e.target.value })}>
            <option value="">No permissions</option>
            {roles.filter((r) => !r.locked && !r.isGuest).map((r) => (
              <option key={r.id} value={r.id}>Copy of {r.displayName}</option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="fay-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-gold" disabled={busy}>Create role</button>
        </div>
      </form>
    </Dialog>
  );
}
