/**
 * Money formatting shared by emails and API responses. Amounts are stored in the currency's major unit
 * (francs, euros, dollars). XAF, XOF and the like have no minor unit, so they are shown without decimals.
 */
const ZERO_DECIMAL = new Set(['XAF', 'XOF', 'JPY', 'KRW', 'RWF', 'UGX', 'GNF', 'KMF', 'VND', 'CLP', 'PYG', 'BIF', 'DJF', 'MGA', 'VUV', 'XPF']);

const decimalsOf = (currency) => (ZERO_DECIMAL.has(String(currency || 'XAF').toUpperCase()) ? 0 : 2);

function formatMoney(amount, currency = 'XAF', locale = 'en-GB') {
  const cur = String(currency || 'XAF').toUpperCase();
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, minimumFractionDigits: decimalsOf(cur), maximumFractionDigits: decimalsOf(cur) }).format(n);
  } catch {
    return `${n.toLocaleString(locale, { maximumFractionDigits: decimalsOf(cur) })} ${cur}`;
  }
}

module.exports = { formatMoney, decimalsOf, ZERO_DECIMAL };
