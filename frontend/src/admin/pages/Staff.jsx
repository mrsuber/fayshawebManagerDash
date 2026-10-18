import { useMemo, useState } from 'react';
import { Card, Icon } from '../../manager/components/ui';
import { useToast } from '../../manager/context/ToastContext';
import { HQ_AREAS } from '../access';
import { hqApi } from '../api';
import { Dialog, ErrorNote, Loading, Pill, Tabs, useHq, useLoad, when } from '../components/parts';
import { startViewAs } from '../viewAs';

const hasHq = (perms = {}) => HQ_AREAS.some((a) => perms[a] && (perms[a].view || perms[a].manage || perms[a].approve));

export default function Staff() {
  const [tab, setTab] = useState('staff');
  return (
    <>
      <Tabs tabs={[['staff', 'Staff'], ['departments', 'Departments']]} value={tab} onChange={setTab} />
      {tab === 'staff' ? <StaffList /> : <Departments />}
    </>
  );
}

function StaffList() {
  const { me, can, properties } = useHq();
  const toast = useToast();
  const staff = useLoad(() => hqApi.staff(), []);
  const roles = useLoad(() => hqApi.roles(), []);
  const depts = useLoad(() => hqApi.departments(), []);
  const [filter, setFilter] = useState({ q: '', department: '', role: '', status: 'active' });
  const [editing, setEditing] = useState(null); // member or 'new'
  const [secret, setSecret] = useState(null);
  const manage = can('staff', 'manage');
  const isSuper = me.user.role === 'superadmin';

  const roleById = useMemo(() => Object.fromEntries((roles.data || []).map((r) => [r.id, r])), [roles.data]);
  const list = (staff.data || []).filter((m) => {
    const q = filter.q.toLowerCase();
    return (
      (!q || [m.name, m.email, m.jobTitle].some((v) => v && v.toLowerCase().includes(q))) &&
      (!filter.department || (m.department || '') === filter.department) &&
      (!filter.role || String(m.role.id) === filter.role) &&
      (!filter.status || m.status === filter.status)
    );
  });
  const departments = [...new Set([...(depts.data || []).map((d) => d.name), ...(staff.data || []).map((m) => m.department).filter(Boolean)])].sort();

  const canViewAs = (m) =>
    isSuper && m.id !== me.user.id && m.role.name !== 'superadmin' && m.status === 'active' && (m.role.name === 'manager' || hasHq(roleById[m.role.id]?.permissions));

  const act = async (fn, ok) => {
    try {
      const r = await fn();
      if (ok) toast(ok);
      staff.reload();
      return r;
    } catch (e) {
      toast(e.message, 'error');
      return null;
    }
  };

  const viewAs = async (m) => {
    try {
      const session = await hqApi.viewAs(m.id);
      startViewAs(session, '/admin/staff');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const resetPassword = async (m) => {
    if (!window.confirm(`Reset ${m.name}'s password? They get a temporary password by email and must choose a new one.`)) return;
    const r = await act(() => hqApi.resetPassword(m.id), null);
    if (r) {
      if (r.tempPassword) setSecret({ name: m.name, email: m.email, password: r.tempPassword });
      else toast(`A temporary password was emailed to ${m.email}`);
    }
  };

  const toggleActive = (m) => {
    const next = m.status === 'active' ? 'inactive' : 'active';
    if (next === 'inactive' && !window.confirm(`Deactivate ${m.name}? They can no longer sign in.`)) return;
    act(() => hqApi.updateStaff(m.id, { status: next }), next === 'active' ? `${m.name} can sign in again` : `${m.name} is deactivated`);
  };

  return (
    <div className="stack">
      <div className="hq-toolbar">
        <input className="hq-input" placeholder="Search name, email or title" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} aria-label="Search staff" style={{ minWidth: 240 }} />
        <select className="hq-select" value={filter.department} onChange={(e) => setFilter({ ...filter, department: e.target.value })} aria-label="Department">
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select className="hq-select" value={filter.role} onChange={(e) => setFilter({ ...filter, role: e.target.value })} aria-label="Role">
          <option value="">All roles</option>
          {(roles.data || []).filter((r) => !r.isGuest).map((r) => (
            <option key={r.id} value={r.id}>{r.displayName}</option>
          ))}
        </select>
        <select className="hq-select" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} aria-label="Status">
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
          <option value="">Everyone</option>
        </select>
        <span style={{ flex: 1 }} />
        {manage && (
          <button type="button" className="btn-gold" onClick={() => setEditing('new')}>
            <Icon name="person_add" size={18} /> Add staff member
          </button>
        )}
      </div>

      <ErrorNote error={staff.error} onRetry={staff.reload} />
      {!staff.data && !staff.error && <Loading />}
      {staff.data && (
        <div className="hq-table-wrap">
          <table className="hq-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Department</th>
                {properties.length > 1 && <th>Property</th>}
                <th>Status</th>
                <th>Last sign-in</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="hq-empty">No one matches.</td>
                </tr>
              )}
              {list.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{m.name}</div>
                    <div className="sub">{m.email}</div>
                  </td>
                  <td>
                    <span className={m.role.name === 'superadmin' ? 'hq-pill hq-pill--gold' : 'hq-pill'}>{m.role.displayName}</span>
                  </td>
                  <td>
                    {m.department || <span className="sub">—</span>}
                    {m.jobTitle && <div className="sub">{m.jobTitle}</div>}
                  </td>
                  {properties.length > 1 && <td>{m.property?.name || <span className="sub">All</span>}</td>}
                  <td>
                    <Pill>{m.status}</Pill> {m.locked && <span className="hq-pill hq-pill--red">locked</span>}
                    {m.mustChangePassword && <div className="sub">awaiting first sign-in</div>}
                  </td>
                  <td className="sub" style={{ fontSize: 13 }}>{m.lastLogin ? when(m.lastLogin) : 'never'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      {canViewAs(m) && (
                        <button type="button" className="mini-btn" title={`View as ${m.name} (read-only)`} aria-label={`View as ${m.name}`} onClick={() => viewAs(m)}>
                          <Icon name="visibility" size={18} />
                        </button>
                      )}
                      {manage && (m.role.name !== 'superadmin' || isSuper) && (
                        <>
                          <button type="button" className="mini-btn" title="Edit" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m)}>
                            <Icon name="edit" size={18} />
                          </button>
                          <button type="button" className="mini-btn" title="Reset password" aria-label={`Reset ${m.name}'s password`} onClick={() => resetPassword(m)}>
                            <Icon name="lock_reset" size={18} />
                          </button>
                          {m.id !== me.user.id && (
                            <button type="button" className="mini-btn" title={m.status === 'active' ? 'Deactivate' : 'Reactivate'} aria-label={`${m.status === 'active' ? 'Deactivate' : 'Reactivate'} ${m.name}`} onClick={() => toggleActive(m)}>
                              <Icon name={m.status === 'active' ? 'person_off' : 'person_check'} size={18} />
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isSuper && <p className="sub" style={{ margin: 0 }}><Icon name="visibility" size={14} /> View as opens a 30-minute, read-only session as that person, so you see exactly what they see. Every view-as session is recorded in the audit log.</p>}

      <MemberDialog
        member={editing}
        roles={(roles.data || []).filter((r) => !r.isGuest && (isSuper || r.name !== 'superadmin'))}
        departments={departments}
        properties={properties}
        self={me.user.id}
        onClose={() => setEditing(null)}
        onSaved={(res) => {
          setEditing(null);
          staff.reload();
          depts.reload();
          if (res?.tempPassword) setSecret({ name: res.member.name, email: res.member.email, password: res.tempPassword });
          else if (res?.member) toast(`${res.member.name} was invited — their sign-in details are in their inbox`);
          else toast('Saved');
        }}
      />
      <Dialog open={!!secret} title="Temporary password" subtitle="Email is not configured, so share this with them yourself. It is shown only once." onClose={() => setSecret(null)} actions={<button type="button" className="btn-gold" onClick={() => setSecret(null)}>Done</button>}>
        {secret && (
          <div className="stack" style={{ gap: 8 }}>
            <div>{secret.name} · {secret.email}</div>
            <code style={{ fontSize: 20, padding: '12px 14px', background: 'var(--input-bg)', borderRadius: 8, border: '1px solid var(--border-strong)', userSelect: 'all' }}>{secret.password}</code>
            <span className="sub">They will be asked to choose a new password when they sign in at /login.</span>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function MemberDialog({ member, roles, departments, properties, self, onClose, onSaved }) {
  const toast = useToast();
  const isNew = member === 'new';
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const key = isNew ? 'new' : member?.id;
  const [loadedFor, setLoadedFor] = useState(null);
  if (!member) return null;
  if (loadedFor !== key) {
    setLoadedFor(key);
    setForm(
      isNew
        ? { name: '', email: '', phone: '', roleId: roles.find((r) => r.name === 'staff')?.id || '', department: '', jobTitle: '', propertyId: properties.length === 1 ? properties[0].id : '' }
        : { name: member.name || '', phone: member.phone || '', roleId: member.role.id, department: member.department || '', jobTitle: member.jobTitle || '', propertyId: member.property?.id || '' },
    );
    return null;
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form, roleId: Number(form.roleId), propertyId: form.propertyId ? Number(form.propertyId) : null };
      const res = isNew ? await hqApi.invite(body) : await hqApi.updateStaff(member.id, body);
      onSaved(isNew ? res : null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const selectedRole = roles.find((r) => String(r.id) === String(form.roleId));
  return (
    <Dialog open title={isNew ? 'Add a staff member' : `Edit ${member.name}`} subtitle={isNew ? 'They receive an email with a temporary password and choose their own when they first sign in.' : member.email} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="hq-form-grid">
          <label className="hq-label">
            Full name
            <input className="hq-input" value={form.name} onChange={set('name')} required />
          </label>
          {isNew && (
            <label className="hq-label">
              Email
              <input className="hq-input" type="email" value={form.email} onChange={set('email')} required />
            </label>
          )}
          <label className="hq-label">
            Phone
            <input className="hq-input" type="tel" value={form.phone} onChange={set('phone')} />
          </label>
          <label className="hq-label">
            Role
            <select className="hq-select" value={form.roleId} onChange={set('roleId')} required disabled={!isNew && member.id === self}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.displayName}</option>
              ))}
            </select>
          </label>
          <label className="hq-label">
            Department
            <input className="hq-input" list="hq-departments" value={form.department} onChange={set('department')} placeholder="e.g. Housekeeping" />
            <datalist id="hq-departments">
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </label>
          <label className="hq-label">
            Job title
            <input className="hq-input" value={form.jobTitle} onChange={set('jobTitle')} placeholder="e.g. Room Attendant" />
          </label>
          {properties.length > 1 && (
            <label className="hq-label">
              Property
              <select className="hq-select" value={form.propertyId} onChange={set('propertyId')}>
                <option value="">All properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {selectedRole?.description && <p className="sub" style={{ margin: 0 }}>{selectedRole.displayName}: {selectedRole.description}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="fay-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-gold" disabled={busy}>{isNew ? 'Send invitation' : 'Save'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function Departments() {
  const { can } = useHq();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => hqApi.departments(), []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const add = async (e) => {
    e.preventDefault();
    try {
      await hqApi.addDepartment(form);
      toast(`${form.name} added`);
      setForm({ name: '', description: '' });
      setAdding(false);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="stack">
      {can('staff', 'manage') && (
        <div>
          <button type="button" className="btn-gold" onClick={() => setAdding(true)}>
            <Icon name="add" size={18} /> Add department
          </button>
        </div>
      )}
      <ErrorNote error={error} onRetry={reload} />
      {!data && !error && <Loading />}
      <div className="grid-cols" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))' }}>
        {data?.map((d) => (
          <Card key={d.name} title={d.name}>
            {d.description && <span style={{ color: 'var(--text-3)', fontSize: 14 }}>{d.description}</span>}
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div className="kpi-n">{d.staff}</div>
                <div className="kpi-l">staff accounts</div>
              </div>
              <div>
                <div className="kpi-n">{d.employees}</div>
                <div className="kpi-l">HR records</div>
              </div>
            </div>
            {d.manager && <span className="sub">Led by {d.manager.name}</span>}
          </Card>
        ))}
      </div>
      <Dialog open={adding} title="Add a department" onClose={() => setAdding(false)}>
        <form onSubmit={add} className="stack">
          <label className="hq-label">
            Name
            <input className="hq-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="hq-label">
            Description
            <input className="hq-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="fay-btn-outline" onClick={() => setAdding(false)}>Cancel</button>
            <button type="submit" className="btn-gold">Add</button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
