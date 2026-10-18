import CloseIcon from '@mui/icons-material/Close';
import { Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip, Icon } from './ui';

/**
 * "View All" pop-up: every item of a card, with a search box and optional filter chips.
 * - `searchText(item)` → string matched against the query (omit to hide search)
 * - `filters`: { options: string[], get(item) → string | string[] } — first option shows everything
 * - `renderItem(item)` → row; `header` renders above the list (e.g. column titles)
 * - `action`: optional node next to the title (e.g. a "New request" button)
 */
export default function ViewAllDialog({ open, onClose, title, items = [], searchText, filters, renderItem, header, action, empty, maxWidth = 'md' }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [f, setF] = useState(0);

  useEffect(() => {
    if (open) {
      setQ('');
      setF(0);
    }
  }, [open]);

  const query = q.trim().toLowerCase();
  const shown = items.filter((item) => {
    if (filters && f > 0) {
      const v = filters.get(item);
      const want = filters.options[f];
      if (Array.isArray(v) ? !v.includes(want) : v !== want) return false;
    }
    return !query || !searchText || searchText(item).toLowerCase().includes(query);
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth} scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, fontFamily: 'var(--serif)', fontSize: 26 }}>
        <span style={{ flex: 1 }}>{title}</span>
        {action}
        <IconButton onClick={onClose} aria-label={t('common.close')}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      {(searchText || filters) && (
        <div className="col" style={{ gap: 10, padding: '0 24px 12px' }}>
          {searchText && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6 }}>
              <Icon name="search" size={18} color="var(--dim)" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('common.search')}
                aria-label={t('common.search')}
                style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: 'var(--text)', fontSize: 14, fontFamily: 'var(--sans)' }}
              />
            </label>
          )}
          {filters && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {filters.options.map((o, i) => (
                <Chip key={o} on={i === f} onClick={() => setF(i)} style={{ padding: '5px 12px', borderRadius: 4, fontSize: 13 }}>
                  {o}
                </Chip>
              ))}
            </div>
          )}
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>{t('common.showing', { shown: shown.length, total: items.length })}</span>
        </div>
      )}
      <DialogContent dividers sx={{ borderColor: 'var(--border)' }}>
        {header}
        {shown.length ? shown.map(renderItem) : <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>{empty || t('common.nothingFound')}</div>}
      </DialogContent>
    </Dialog>
  );
}
