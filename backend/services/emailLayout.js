/**
 * The Faysha email look: dark ground, gold, ivory — the same tokens as the website and app.
 * Inline styles only (Gmail and Outlook drop <style> blocks), a single 600px column, and a hidden preheader.
 */
const C = { ground: '#0a0c0f', surface: '#101318', line: '#262a31', gold: '#e8b84a', text: '#ece6da', muted: '#a49d90' };

const esc = (v) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const serif = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const sans = "Jost, 'Helvetica Neue', Arial, sans-serif";

/** A label / value row. */
const row = (label, value) => `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid ${C.line};font:13px ${sans};color:${C.muted};letter-spacing:.04em">${esc(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${C.line};font:15px ${sans};color:${C.text};text-align:right">${value}</td>
  </tr>`;

/** A boxed section with a small gold eyebrow. `html` is trusted markup. */
const panel = (eyebrow, html) => `
  <div style="margin:22px 0;padding:22px;border:1px solid ${C.line};border-radius:14px;background:${C.surface}">
    <div style="font:600 11px ${sans};letter-spacing:.24em;color:${C.gold};text-transform:uppercase;margin-bottom:12px">${esc(eyebrow)}</div>
    ${html}
  </div>`;

/** A large code (PIN) with its caption. */
const code = (value, caption) => `
  <div style="text-align:center;margin:6px 0">
    <div style="font:600 34px 'Courier New',monospace;letter-spacing:.32em;color:${C.gold}">${esc(value)}</div>
    ${caption ? `<div style="font:12px ${sans};color:${C.muted};margin-top:4px">${esc(caption)}</div>` : ''}
  </div>`;

const button = (href, label) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${C.gold};color:${C.ground};font:600 13px ${sans};letter-spacing:.18em;text-transform:uppercase;text-decoration:none;padding:14px 26px;border-radius:8px">${esc(label)}</a>`;

function layout({ preheader = '', title, intro = '', body = '' }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.ground}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ground}">
    <tr><td align="center" style="padding:32px 14px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="text-align:center;padding:8px 0 26px">
          <div style="font:600 22px Cinzel,${serif};letter-spacing:.42em;color:${C.gold}">FAYSHA</div>
          <div style="font:11px ${sans};letter-spacing:.32em;color:${C.muted};margin-top:6px">WELLNESS RESIDENCE</div>
        </td></tr>
        <tr><td style="background:${C.surface};border:1px solid ${C.line};border-radius:18px;padding:34px 30px">
          <h1 style="margin:0 0 12px;font:400 30px ${serif};color:${C.text};letter-spacing:.02em">${esc(title)}</h1>
          ${intro ? `<p style="margin:0 0 6px;font:15px/1.65 ${sans};color:${C.muted}">${intro}</p>` : ''}
          ${body}
        </td></tr>
        <tr><td style="text-align:center;padding:24px 10px;font:12px/1.7 ${sans};color:${C.muted}">
          Faysha Wellness Residence · Cameroon<br>
          ${process.env.CONTACT_EMAIL ? `<a href="mailto:${esc(process.env.CONTACT_EMAIL)}" style="color:${C.gold};text-decoration:none">${esc(process.env.CONTACT_EMAIL)}</a> · ` : ''}<a href="${esc(process.env.APP_URL || 'https://fayshaa.com')}" style="color:${C.gold};text-decoration:none">${esc((process.env.APP_URL || 'https://fayshaa.com').replace(/^https?:\/\//, ''))}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

module.exports = { C, esc, row, panel, code, button, layout, sans, serif };
