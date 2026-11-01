import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getStayPolicy } from './api';

/**
 * The currency prices are shown in. Prices are XAF; a guest can view them in another accepted currency (rates from
 * FAY OS → Settings → Currencies; EUR is pegged at 655.957 XAF). Converted prices are approximate (≈) and a card
 * payment can be made in the chosen currency at the same rate.
 */
const KEY = 'faysha.currency';
const BASE = 'XAF';
const ZERO = ['XAF', 'XOF', 'JPY', 'KRW', 'RWF', 'UGX', 'GNF'];
let state = { code: BASE, rates: { XAF: 1 }, accepted: [BASE] };

const read = () => {
  try {
    return localStorage.getItem(KEY) || BASE;
  } catch {
    return BASE;
  }
};

/** The chosen currency, if a rate for it is known. */
export const displayCurrency = () => (state.rates[state.code] ? state.code : BASE);
export const isConverted = () => displayCurrency() !== BASE;

/** An XAF amount in the display currency, formatted without the code: "68.60", "45,000". */
export function convertedNumber(xaf) {
  const code = displayCurrency();
  const value = (Number(xaf) || 0) / (state.rates[code] || 1);
  const dp = ZERO.includes(code) ? 0 : 2;
  return value.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

const Ctx = createContext(null);

export function CurrencyProvider({ children }) {
  const [code, setCode] = useState(read);
  const [info, setInfo] = useState(state);

  useEffect(() => {
    getStayPolicy()
      .then((p) => {
        const c = p.currencies || {};
        state = { ...state, rates: { XAF: 1, ...(c.rates || {}) }, accepted: c.accepted || [BASE] };
        setInfo({ ...state });
      })
      .catch(() => {});
  }, []);

  state = { ...state, code };
  const choose = useCallback((next) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable */
    }
    setCode(next);
  }, []);

  return <Ctx.Provider value={{ code: displayCurrency(), accepted: info.accepted, rates: info.rates, choose }}>{children}</Ctx.Provider>;
}

export const useCurrency = () => useContext(Ctx) || { code: BASE, accepted: [BASE], rates: { XAF: 1 }, choose: () => {} };
