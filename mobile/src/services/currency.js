import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './api';

/**
 * Display currency for the app. Prices are XAF; a guest can see them in another currency offered by the residence
 * (FAY OS → Settings → Currencies; EUR is pegged at 655.957 XAF). Converted amounts are approximate (≈); card
 * payments can be made in the chosen currency, mobile money is always XAF.
 */
const KEY = 'faysha.currency';
const ZERO = ['XAF', 'XOF'];
const SYMBOL = { EUR: '€', USD: '$', GBP: '£' };
const state = { code: 'XAF', rates: { XAF: 1 }, accepted: ['XAF'] };
const listeners = new Set();

export const currencyState = () => state;
export const onCurrencyChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((fn) => fn({ ...state }));

/** Loads the offered currencies and the guest's choice (call once at start; safe offline). */
export async function initCurrency() {
  try {
    state.code = (await AsyncStorage.getItem(KEY)) || 'XAF';
  } catch {
    /* storage unavailable */
  }
  try {
    const p = await apiClient.get('/content/stay-policy');
    const c = p?.currencies || {};
    state.rates = { XAF: 1, ...(c.rates || {}) };
    state.accepted = c.accepted || ['XAF'];
  } catch {
    /* keep XAF */
  }
  if (!state.rates[state.code]) state.code = 'XAF';
  emit();
}

export async function setCurrency(code) {
  state.code = state.rates[code] ? code : 'XAF';
  try {
    await AsyncStorage.setItem(KEY, state.code);
  } catch {
    /* storage unavailable */
  }
  emit();
}

/** An XAF amount in the display currency: "45 000 XAF", "≈ €68.60". */
export function formatDisplay(xafAmount) {
  const n = Number(xafAmount) || 0;
  if (state.code === 'XAF' || !state.rates[state.code]) return `${Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')} XAF`;
  const v = n / state.rates[state.code];
  const dp = ZERO.includes(state.code) ? 0 : 2;
  const s = v.toFixed(dp).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return SYMBOL[state.code] ? `≈ ${SYMBOL[state.code]}${s}` : `≈ ${s} ${state.code}`;
}
