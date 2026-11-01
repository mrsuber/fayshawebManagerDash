import { Alert, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useEffect, useState } from 'react';
import { opsApi } from '../api';
import { TextInput } from './kit';
import { Icon } from './ui';

/**
 * A supervisor's inspection of a residence after cleaning: the checklist (FAY OS → Housekeeping), a score for the clean,
 * notes. Every item ticked → Ready; anything missed → back to Dirty with the items to redo.
 */
export default function InspectionDialog({ room, onClose, onDone }) {
  const [items, setItems] = useState([]);
  const [score, setScore] = useState(5);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!room) return;
    setScore(5);
    setNotes('');
    setError('');
    opsApi.checklist().then((list) => setItems(list.map((item) => ({ item, ok: false })))).catch((e) => setError(e.message));
  }, [room]);

  const all = items.length > 0 && items.every((i) => i.ok);
  const submit = () => {
    setBusy(true);
    setError('');
    opsApi
      .inspect(room.id, { checklist: items, score, notes })
      .then((r) => onDone(r))
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={!!room} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Inspect {room?.residence}{room?.cleanedBy ? ` · cleaned by ${room.cleanedBy}` : ''}</DialogTitle>
      <DialogContent>
        <div className="col" style={{ gap: 4 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {items.map((it, i) => (
            <label key={it.item} className="hov-row" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 6px', borderBottom: '1px solid var(--border-soft)', cursor: 'pointer', fontSize: 14.5 }}>
              <input type="checkbox" checked={it.ok} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, ok: e.target.checked } : x)))} style={{ width: 18, height: 18, accentColor: '#e8b84a' }} />
              {it.item}
            </label>
          ))}
          <span className="kit-label" style={{ marginTop: 14 }}>Quality of the clean</span>
          <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="Score">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={score === n} onClick={() => setScore(n)} style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: 28, color: n <= score ? '#e8b84a' : '#3a3f48', padding: 2 }}>
                ★
              </button>
            ))}
          </div>
          <TextInput label="Notes for the team" multiline rows={2} value={notes} onChange={setNotes} />
        </div>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <button type="button" className="fay-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-gold" onClick={submit} disabled={busy || !items.length}>
          <Icon name={all ? 'verified' : 'replay'} size={18} />
          {all ? 'Pass — residence ready' : 'Send back for re-cleaning'}
        </button>
      </DialogActions>
    </Dialog>
  );
}
