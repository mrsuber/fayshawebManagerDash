import { Alert, Autocomplete, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Small form in a dialog. `fields`: [{ name, label, type, options, required, rows, helperText }]
 * type: text | textarea | select | number | datetime | date | tags (free-text multi-select; `options` are suggestions).
 * `onSubmit(values)` returns a promise; the dialog closes when it resolves and shows the error if it rejects.
 */
export default function FormDialog({ open, title, subtitle, fields, initial, submitLabel, onSubmit, onClose }) {
  const { t } = useTranslation();
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setValues({ ...Object.fromEntries(fields.map((f) => [f.name, f.type === 'tags' ? [] : ''])), ...initial });
    setError('');
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  const submit = (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    onSubmit(values)
      .then(() => onClose())
      .catch((err) => setError(err.message || t('common.updateFailed')))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle sx={{ pb: subtitle ? 0 : undefined }}>{title}</DialogTitle>
        {subtitle && <div style={{ padding: '4px 24px 0', fontSize: 14, color: 'var(--muted)' }}>{subtitle}</div>}
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {fields.map((f) => {
              const common = { label: f.label, required: f.required, helperText: f.helperText, fullWidth: true };
              if (f.type === 'tags') {
                return (
                  <Autocomplete
                    key={f.name}
                    multiple
                    freeSolo
                    options={f.options || []}
                    value={values[f.name] || []}
                    onChange={(_, v) => set(f.name, v)}
                    renderTags={(v, getTagProps) => v.map((opt, i) => <Chip label={opt} size="small" {...getTagProps({ index: i })} key={opt} />)}
                    renderInput={(params) => <TextField {...params} label={f.label} helperText={f.helperText} />}
                  />
                );
              }
              if (f.type === 'select') {
                return (
                  <TextField key={f.name} {...common} select value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}>
                    {f.options.map((o) => {
                      const [value, label] = Array.isArray(o) ? o : [o, o];
                      return (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                );
              }
              return (
                <TextField
                  key={f.name}
                  {...common}
                  type={f.type === 'datetime' ? 'datetime-local' : f.type === 'textarea' ? 'text' : f.type || 'text'}
                  multiline={f.type === 'textarea'}
                  minRows={f.type === 'textarea' ? f.rows || 3 : undefined}
                  InputLabelProps={f.type === 'datetime' || f.type === 'date' ? { shrink: true } : undefined}
                  value={values[f.name] ?? ''}
                  onChange={(e) => set(f.name, e.target.value)}
                  autoFocus={f.autoFocus}
                />
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {submitLabel || t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
