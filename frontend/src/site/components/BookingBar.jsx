import { useEffect, useState } from 'react';
import { addDays, today } from '../format';
import { plural, useLang } from '../i18n';
import { Icon } from './ui';

/**
 * Dates + guests (+ optional residence type) search bar.
 * Calls onSearch({ checkIn, checkOut, guests, type }) on submit.
 */
export default function BookingBar({ stay, residences, type = 'all', onSearch, solid = false, submitLabel }) {
  const { t } = useLang();
  const [checkIn, setCheckIn] = useState(stay.checkIn);
  const [checkOut, setCheckOut] = useState(stay.checkOut);
  const [guests, setGuests] = useState(stay.guests);
  const [kind, setKind] = useState(type);

  useEffect(() => {
    setCheckIn(stay.checkIn);
    setCheckOut(stay.checkOut);
    setGuests(stay.guests);
  }, [stay.checkIn, stay.checkOut, stay.guests]);
  useEffect(() => setKind(type), [type]);

  const changeCheckIn = (v) => {
    setCheckIn(v);
    if (v && checkOut <= v) setCheckOut(addDays(v, 1));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!checkIn || !checkOut) return;
    onSearch({ checkIn, checkOut, guests, type: kind });
  };

  return (
    <form className={`fs-bookbar${solid ? ' fs-bookbar--solid' : ''}`} onSubmit={submit} aria-label={t('bar.check')}>
      <label className="fs-bookbar__cell">
        <span className="fs-bookbar__label">{t('bar.checkin')}</span>
        <input className="fs-bookbar__input" type="date" min={today()} value={checkIn} onChange={(e) => changeCheckIn(e.target.value)} required />
      </label>
      <label className="fs-bookbar__cell">
        <span className="fs-bookbar__label">{t('bar.checkout')}</span>
        <input
          className="fs-bookbar__input"
          type="date"
          min={checkIn ? addDays(checkIn, 1) : today()}
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          required
        />
      </label>
      <div className="fs-bookbar__cell fs-bookbar__guests">
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="fs-bookbar__label" id="fs-guests-label">
            {t('bar.guests')}
          </span>
          <span style={{ fontSize: 15 }} aria-live="polite" aria-labelledby="fs-guests-label">
            {plural(t, guests, 'guest.one', 'guest.many')}
          </span>
        </span>
        <span className="fs-stepper">
          <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))} disabled={guests <= 1} aria-label={t('bar.fewer')}>
            −
          </button>
          <button type="button" onClick={() => setGuests((g) => Math.min(12, g + 1))} disabled={guests >= 12} aria-label={t('bar.more')}>
            +
          </button>
        </span>
      </div>
      {residences && (
        <label className="fs-bookbar__cell">
          <span className="fs-bookbar__label">{t('bar.residence')}</span>
          <select className="fs-bookbar__input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">{t('bar.any')}</option>
            {residences.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" className="fs-btn fs-btn--gold fs-bookbar__go">
        {submitLabel || t('bar.check')}
        <Icon name="arrow" size={16} stroke={1.8} />
      </button>
    </form>
  );
}
