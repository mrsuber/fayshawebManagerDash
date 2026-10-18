import { useState } from 'react';
import { Card, Icon } from '../../manager/components/ui';
import { useToast } from '../../manager/context/ToastContext';
import { hqApi } from '../api';
import { Dialog, Pill, day, useHq } from '../components/parts';

const EMPTY = { code: '', name: '', city: '', country: 'Cameroon', address: '', timezone: 'Africa/Douala', currency: 'XAF', status: 'opening', openedOn: '' };

export default function Properties() {
  const { properties, refreshProperties, can, setProperty } = useHq();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const manage = can('properties', 'manage');

  return (
    <div className="stack">
      <p style={{ margin: 0, color: 'var(--text-3)', maxWidth: 760, lineHeight: 1.6 }}>
        Each Faysha residence is a property. Residences (units), staff and figures belong to a property, and the property selector at the top of HQ focuses
        the Overview and Finance on one of them. Add the next property here when it starts opening.
      </p>
      {manage && (
        <div>
          <button type="button" className="btn-gold" onClick={() => setEditing('new')}>
            <Icon name="add_business" size={18} /> Add a property
          </button>
        </div>
      )}
      <div className="grid-cols" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))' }}>
        {properties.map((p) => (
          <Card key={p.id} title={p.name} aside={<Pill>{p.status}</Pill>}>
            <span className="sub" style={{ fontSize: 13 }}>
              {p.code} · {[p.city, p.country].filter(Boolean).join(', ') || 'Location not set'}
            </span>
            {p.address && <span style={{ color: 'var(--text-3)', fontSize: 14 }}>{p.address}</span>}
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div className="kpi-n">{p.units}</div>
                <div className="kpi-l">residences</div>
              </div>
              <div>
                <div className="kpi-n">{p.staff}</div>
                <div className="kpi-l">staff based here</div>
              </div>
            </div>
            <span className="sub">
              {p.currency} · {p.timezone}
              {p.openedOn ? ` · opened ${day(p.openedOn)}` : ''}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {properties.length > 1 && (
                <button type="button" className="fay-btn-outline" onClick={() => setProperty(p.id)}>
                  Focus HQ on this property
                </button>
              )}
              {manage && (
                <button type="button" className="fay-btn-outline" onClick={() => setEditing(p)}>
                  Edit
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>
      <PropertyDialog
        property={editing}
        onClose={() => setEditing(null)}
        onSaved={(msg) => {
          setEditing(null);
          toast(msg);
          refreshProperties();
        }}
      />
    </div>
  );
}

function PropertyDialog({ property, onClose, onSaved }) {
  const toast = useToast();
  const isNew = property === 'new';
  const [form, setForm] = useState(EMPTY);
  const [loadedFor, setLoadedFor] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!property) return null;
  const key = isNew ? 'new' : property.id;
  if (loadedFor !== key) {
    setLoadedFor(key);
    setForm(isNew ? EMPTY : { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, property[k] ?? ''])), openedOn: property.openedOn ? String(property.openedOn).slice(0, 10) : '' });
    return null;
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isNew) await hqApi.addProperty(form);
      else await hqApi.updateProperty(property.id, form);
      onSaved(isNew ? `${form.name} added` : 'Saved');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open title={isNew ? 'Add a property' : `Edit ${property.name}`} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="hq-form-grid">
          <label className="hq-label">
            Name
            <input className="hq-input" value={form.name} onChange={set('name')} required />
          </label>
          <label className="hq-label">
            Short code
            <input className="hq-input" value={form.code} onChange={set('code')} required maxLength={20} placeholder="e.g. FKB" />
          </label>
          <label className="hq-label">
            City
            <input className="hq-input" value={form.city} onChange={set('city')} />
          </label>
          <label className="hq-label">
            Country
            <input className="hq-input" value={form.country} onChange={set('country')} />
          </label>
          <label className="hq-label">
            Status
            <select className="hq-select" value={form.status} onChange={set('status')}>
              <option value="opening">Opening soon</option>
              <option value="active">Open</option>
              <option value="inactive">Closed</option>
            </select>
          </label>
          <label className="hq-label">
            Opened on
            <input className="hq-input" type="date" value={form.openedOn} onChange={set('openedOn')} style={{ colorScheme: 'dark' }} />
          </label>
          <label className="hq-label">
            Currency
            <input className="hq-input" value={form.currency} onChange={set('currency')} maxLength={3} />
          </label>
          <label className="hq-label">
            Time zone
            <input className="hq-input" value={form.timezone} onChange={set('timezone')} />
          </label>
        </div>
        <label className="hq-label">
          Address
          <input className="hq-input" value={form.address} onChange={set('address')} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="fay-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-gold" disabled={busy}>{isNew ? 'Add property' : 'Save'}</button>
        </div>
      </form>
    </Dialog>
  );
}
