import moment from 'moment';
import { useEffect, useState } from 'react';
import { settingsApi } from '../api';
import { useToast } from '../context/ToastContext';
import { Card } from './ui';

const PEGGED = { XAF: 'base', XOF: 'pegged 1:1', EUR: 'pegged — CFA franc' };
const KNOWN = ['XAF', 'EUR', 'USD', 'GBP', 'XOF', 'NGN', 'CAD', 'CHF', 'AED', 'ZAR', 'GHS'];

/**
 * Settings → Currencies: which currencies guests can see prices and pay by card in, and the rates (XAF for 1 unit).
 * EUR (655.957) and XOF are fixed by the CFA franc peg; the others float, so their rates are kept up to date here.
 */
export default function CurrencySettings() {
  const toast = useToast();
  const [v, setV] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    settingsApi.getCurrencies().then(setV).catch((e) => toast(e.message, 'error'));
  }, [toast]);
  if (!v) return null;
  const toggle = (c) => setV({ ...v, accepted: v.accepted.includes(c) ? v.accepted.filter((x) => x !== c) : [...v.accepted, c] });
  const stale = v.updatedAt && moment().diff(moment(v.updatedAt), 'days') > 7;
  return (
    <Card title="Currencies" gap={10}>
      <span className="sub">
        Prices are kept in {v.base}. Guests can view them in the currencies ticked here and pay by card in them, at these rates; mobile money is always in {v.base}.
        {v.updatedAt ? ` Rates updated ${moment(v.updatedAt).fromNow()}${v.updatedBy ? ` by ${v.updatedBy}` : ''}.` : ''}
      </span>
      {stale ? <span className="kit-error">The floating rates are over a week old — check them against your bank’s rate.</span> : null}
      <div className="kit-scroll">
        <table className="kit-table" style={{ minWidth: 420 }}>
          <thead><tr><th>Offered</th><th>Currency</th><th>{v.base} for 1</th><th /></tr></thead>
          <tbody>
            {KNOWN.map((c) => (
              <tr key={c}>
                <td><input type="checkbox" checked={v.accepted.includes(c)} disabled={c === v.base} onChange={() => toggle(c)} style={{ width: 17, height: 17, accentColor: '#e8b84a' }} aria-label={`Offer ${c}`} /></td>
                <td>{c}</td>
                <td>
                  {PEGGED[c] ? (
                    <span>{v.rates[c]}</span>
                  ) : (
                    <input className="kit-input" type="number" step="any" min="0" style={{ width: 130 }} value={v.rates[c] ?? ''} onChange={(e) => setV({ ...v, rates: { ...v.rates, [c]: e.target.value } })} aria-label={`${v.base} for 1 ${c}`} />
                  )}
                </td>
                <td className="sub">{PEGGED[c] || 'floating'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="kit-actions" style={{ justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn-gold"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            const rates = Object.fromEntries(Object.entries(v.rates).filter(([c]) => !PEGGED[c]).map(([c, r]) => [c, Number(r)]));
            settingsApi
              .saveCurrencies({ accepted: v.accepted, rates })
              .then((saved) => {
                setV(saved);
                toast('Currencies saved — the website and app use these rates now');
              })
              .catch((e) => toast(e.message, 'error'))
              .finally(() => setBusy(false));
          }}
        >
          Save currencies
        </button>
      </div>
    </Card>
  );
}
