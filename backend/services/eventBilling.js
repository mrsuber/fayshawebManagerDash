/**
 * Event billing: invoices, receipts and the account of an event. Money for an event is only taken through the
 * platform (the proposal page: card or mobile money) or recorded by the team in FAY OS, and every payment gets a
 * numbered receipt; the invoice and receipts are printable pages linked from the proposal and sent by email.
 */
const db = require('../config/database');
const { esc } = require('./emailLayout');
const { formatMoney } = require('../utils/money');

const appUrl = () => (process.env.APP_URL || 'https://fayshaa.com').replace(/\/$/, '');
const apiUrl = () => (process.env.PUBLIC_API_URL || `${appUrl()}/api`).replace(/\/$/, '');
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const typeLabel = (t) => require('./events').TYPE_LABEL[t] || t;
const METHOD = { stripe: 'Card', mobile_money: 'Mobile money', cash: 'Cash at the residence', bank_transfer: 'Bank transfer', card_terminal: 'Card terminal' };

async function ensureInvoice(quoteId) {
  const { rows } = await db.query(
    `UPDATE event_quotes SET invoice_number = 'FW-INV-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('event_invoice_seq')::text, 5, '0'), invoiced_at = NOW()
      WHERE id = $1 AND invoice_number IS NULL RETURNING invoice_number`,
    [quoteId],
  );
  return rows[0]?.invoice_number || (await db.query('SELECT invoice_number FROM event_quotes WHERE id = $1', [quoteId])).rows[0]?.invoice_number;
}

async function ensureReceipt(paymentId) {
  await db.query(
    `UPDATE payments SET receipt_number = 'FW-RCT-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('payment_receipt_seq')::text, 6, '0')
      WHERE id = $1 AND receipt_number IS NULL AND status = 'completed'`,
    [paymentId],
  );
  return (await db.query('SELECT receipt_number FROM payments WHERE id = $1', [paymentId])).rows[0]?.receipt_number || null;
}

/** The accepted proposal, what was paid (completed payments) and what is left. */
async function account(eventId) {
  const q = (await db.query(`SELECT * FROM event_quotes WHERE event_id = $1 AND status = 'accepted' ORDER BY version DESC LIMIT 1`, [eventId])).rows[0] || null;
  const pays = (await db.query(
    `SELECT id, payment_method, amount, currency, status, paid_at, created_at, receipt_number, transaction_reference
       FROM payments WHERE event_request_id = $1 AND status IN ('completed', 'refunded') ORDER BY COALESCE(paid_at, created_at), id`,
    [eventId],
  )).rows;
  const paid = pays.filter((p) => p.status === 'completed').reduce((s, p) => s + Number(p.amount), 0);
  const total = q ? Number(q.total) : 0;
  const deposit = q ? Number(q.deposit_amount) : 0;
  return {
    quote: q,
    total,
    deposit,
    paid,
    depositDue: Math.max(0, deposit - paid),
    balance: Math.max(0, total - paid),
    paidInFull: Boolean(q) && paid >= total - 0.005,
    payments: pays.map((p) => ({
      id: p.id,
      method: METHOD[p.payment_method] || p.payment_method,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      paidAt: p.paid_at || p.created_at,
      receiptNumber: p.receipt_number,
      reference: p.transaction_reference,
    })),
  };
}

const links = (token) => ({
  invoice: `${apiUrl()}/events/quote/${token}/invoice`,
  receipt: (paymentId) => `${apiUrl()}/events/quote/${token}/receipt/${paymentId}`,
  proposal: `${appUrl()}/events/quote/${token}`,
});

/** A printable A4 page in the house style (light, so it prints); the browser's Print → Save as PDF gives the PDF. */
function page(title, inner) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm }
  body { margin: 0; background: #f4f1ea; color: #1d1b17; font: 14px/1.55 'Helvetica Neue', Arial, sans-serif }
  .sheet { max-width: 780px; margin: 24px auto; background: #fff; padding: 44px 48px; border-radius: 10px; box-shadow: 0 6px 30px rgba(0,0,0,.08) }
  .brand { font: 600 22px Georgia, serif; letter-spacing: .4em; color: #a8822f }
  .brand small { display: block; font: 10px Arial; letter-spacing: .3em; color: #8a8476; margin-top: 4px }
  .head { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #a8822f; padding-bottom: 18px }
  h1 { font: 400 30px Georgia, serif; margin: 0; text-align: right } h1 small { display: block; font: 13px Arial; color: #6b665c; margin-top: 4px }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 22px 0 }
  .meta b { display: block; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #8a8476; margin-bottom: 4px }
  table { width: 100%; border-collapse: collapse; margin-top: 10px }
  th { text-align: left; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #8a8476; border-bottom: 1px solid #ddd6c8; padding: 8px 6px }
  td { padding: 9px 6px; border-bottom: 1px solid #eee8dc; vertical-align: top } td.n, th.n { text-align: right; white-space: nowrap }
  .tot td { border: 0; padding: 5px 6px } .tot .big td { font-size: 17px; font-weight: 700; border-top: 2px solid #1d1b17; padding-top: 10px }
  .stamp { display: inline-block; border: 2px solid #2e8b57; color: #2e8b57; padding: 6px 14px; border-radius: 6px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; transform: rotate(-3deg) }
  .note { margin-top: 26px; padding: 14px 16px; background: #faf6ec; border-left: 3px solid #a8822f; font-size: 12.5px; color: #4a463e }
  .actions { text-align: center; margin: 18px } .actions button { background: #a8822f; color: #fff; border: 0; padding: 10px 22px; border-radius: 6px; font-size: 14px; cursor: pointer }
  @media print { body { background: #fff } .sheet { box-shadow: none; margin: 0; padding: 0 } .actions { display: none } }
</style></head><body>
<div class="actions"><button onclick="window.print()">Print or save as PDF</button></div>
<div class="sheet">${inner}</div></body></html>`;
}

const header = (title, sub) => `
  <div class="head">
    <div><div class="brand">FAYSHA<small>WELLNESS RESIDENCE</small></div>
      <div style="margin-top:12px;font-size:12px;color:#6b665c">Faysha Wellness Residence · Cameroon${process.env.CONTACT_EMAIL ? `<br>${esc(process.env.CONTACT_EMAIL)}` : ''}<br>${esc(appUrl().replace(/^https?:\/\//, ''))}</div></div>
    <h1>${esc(title)}<small>${sub}</small></h1>
  </div>`;

async function load(token) {
  const q = (await db.query(
    `SELECT q.*, e.id AS ev_id, e.reference, e.name, e.email, e.phone, e.organisation, e.event_type, e.title, e.event_date, e.guests
       FROM event_quotes q JOIN event_requests e ON e.id = q.event_id WHERE q.token = $1`,
    [String(token || '')],
  )).rows[0];
  if (!q) throw Object.assign(new Error('This link is not valid'), { status: 404 });
  return q;
}

async function invoiceHtml(token) {
  const q = await load(token);
  if (q.status !== 'accepted' || !q.invoice_number) throw Object.assign(new Error('The invoice is issued once the proposal is accepted'), { status: 409 });
  const acc = await account(q.ev_id);
  const m = (n) => esc(formatMoney(n, q.currency));
  const lines = (q.items || [])
    .map((it) => `<tr><td>${esc(it.label)}${it.detail ? `<div style="font-size:12px;color:#6b665c">${esc(it.detail)}</div>` : ''}</td><td class="n">${esc(it.qty)}${it.unit ? ` ${esc(it.unit)}` : ''}</td><td class="n">${m(it.unitPrice)}</td><td class="n">${m(it.qty * it.unitPrice)}</td></tr>`)
    .join('');
  const pays = acc.payments
    .filter((p) => p.status === 'completed')
    .map((p) => `<tr><td>${esc(iso(p.paidAt))}</td><td>${esc(p.method)}</td><td>${esc(p.receiptNumber || '')}</td><td class="n">${m(p.amount)}</td></tr>`)
    .join('');
  return page(`Invoice ${q.invoice_number}`, `
    ${header('Invoice', `${esc(q.invoice_number)} · issued ${esc(iso(q.invoiced_at))}`)}
    <div class="meta">
      <div><b>Billed to</b>${esc(q.name)}${q.organisation ? `<br>${esc(q.organisation)}` : ''}<br>${esc(q.email)}${q.phone ? `<br>${esc(q.phone)}` : ''}</div>
      <div><b>Event</b>${esc(q.title || typeLabel(q.event_type))} · ${esc(q.reference)}<br>${q.event_date ? `${esc(iso(q.event_date))} · ` : ''}${esc(q.guests)} guests<br>Proposal v${esc(q.version)}, accepted by ${esc(q.response_name || q.name)} on ${esc(iso(q.responded_at))}</div>
    </div>
    <table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Amount</th></tr></thead><tbody>${lines}</tbody></table>
    <table class="tot" style="width:320px;margin-left:auto">
      <tr><td>Subtotal</td><td class="n">${m(q.subtotal)}</td></tr>
      ${Number(q.discount) ? `<tr><td>Discount</td><td class="n">− ${m(q.discount)}</td></tr>` : ''}
      ${Number(q.tax) ? `<tr><td>Tax (${esc(Number(q.tax_rate))}%)</td><td class="n">${m(q.tax)}</td></tr>` : ''}
      <tr class="big"><td>Total</td><td class="n">${m(q.total)}</td></tr>
      <tr><td>Paid</td><td class="n">${m(acc.paid)}</td></tr>
      <tr><td><b>${acc.paidInFull ? 'Balance' : 'Balance due'}</b></td><td class="n"><b>${m(acc.balance)}</b></td></tr>
      ${acc.depositDue > 0 ? `<tr><td style="color:#a8822f">Deposit due now (${esc(Number(q.deposit_percent))}%)</td><td class="n" style="color:#a8822f">${m(acc.depositDue)}</td></tr>` : ''}
    </table>
    ${acc.paidInFull ? '<div style="margin-top:18px"><span class="stamp">Paid in full</span></div>' : ''}
    ${pays ? `<h3 style="font:400 18px Georgia,serif;margin:28px 0 0">Payments received</h3><table><thead><tr><th>Date</th><th>Method</th><th>Receipt</th><th class="n">Amount</th></tr></thead><tbody>${pays}</tbody></table>` : ''}
    <div class="note"><b>How to pay.</b> Pay only from your proposal page — ${esc(links(token).proposal)} — by card or MTN / Orange mobile money, or to the Faysha team at the residence against an official receipt. Faysha staff never ask for payment to a personal account; every payment receives a numbered receipt from this platform.</div>
  `);
}

async function receiptHtml(token, paymentId) {
  const q = await load(token);
  const p = (await db.query(`SELECT * FROM payments WHERE id = $1 AND event_request_id = $2 AND status IN ('completed', 'refunded')`, [paymentId, q.ev_id])).rows[0];
  if (!p) throw Object.assign(new Error('Receipt not found'), { status: 404 });
  const number = p.receipt_number || (await ensureReceipt(p.id));
  const acc = await account(q.ev_id);
  const m = (n) => esc(formatMoney(n, p.currency || q.currency));
  return page(`Receipt ${number}`, `
    ${header('Receipt', `${esc(number)} · ${esc(iso(p.paid_at || p.created_at))}`)}
    <div class="meta">
      <div><b>Received from</b>${esc(q.name)}${q.organisation ? `<br>${esc(q.organisation)}` : ''}<br>${esc(q.email)}</div>
      <div><b>For</b>${esc(q.title || typeLabel(q.event_type))} · ${esc(q.reference)}${q.invoice_number ? `<br>Invoice ${esc(q.invoice_number)}` : ''}</div>
    </div>
    <table class="tot" style="width:100%">
      <tr class="big"><td>Amount received</td><td class="n">${m(p.amount)}</td></tr>
      <tr><td>Method</td><td class="n">${esc(METHOD[p.payment_method] || p.payment_method)}${p.transaction_reference ? ` · ref. ${esc(p.transaction_reference)}` : ''}</td></tr>
      <tr><td>Total of the event</td><td class="n">${m(acc.total)}</td></tr>
      <tr><td>Paid to date</td><td class="n">${m(acc.paid)}</td></tr>
      <tr><td><b>Balance</b></td><td class="n"><b>${m(acc.balance)}</b></td></tr>
    </table>
    <div style="margin-top:22px"><span class="stamp">${p.status === 'refunded' ? 'Refunded' : 'Received with thanks'}</span></div>
    <div class="note">This receipt is issued by the Faysha platform and can be checked at ${esc(links(token).proposal)}. Keep it with your invoice.</div>
  `);
}

/** Emails the receipt link (after a payment is recorded). */
async function emailReceipt(paymentId) {
  const p = (await db.query(
    `SELECT p.*, e.name, e.email, e.reference, q.token FROM payments p JOIN event_requests e ON e.id = p.event_request_id
       LEFT JOIN LATERAL (SELECT token FROM event_quotes WHERE event_id = e.id AND status = 'accepted' ORDER BY version DESC LIMIT 1) q ON true
      WHERE p.id = $1`,
    [paymentId],
  )).rows[0];
  if (!p || !p.token || !p.receipt_number) return;
  const { layout, panel, row, button } = require('./emailLayout');
  const acc = await account(p.event_request_id);
  const m = (n) => formatMoney(n, p.currency);
  await require('./email.service').sendEmail({
    to: p.email,
    subject: `Receipt ${p.receipt_number} · ${p.reference}`,
    html: layout({
      title: 'Payment received',
      intro: `Dear ${esc(p.name)}, thank you. Here is your receipt.`,
      body: `${panel('Receipt', `<table role="presentation" width="100%">${row('Receipt', esc(p.receipt_number))}${row('Amount', esc(m(p.amount)))}${row('Paid to date', esc(m(acc.paid)))}${row('Balance', esc(m(acc.balance)))}</table>`)}
        <div style="text-align:center;margin-top:20px">${button(links(p.token).receipt(p.id), 'View the receipt')}</div>`,
    }),
    text: `Dear ${p.name},\n\nWe received ${m(p.amount)} for ${p.reference}. Receipt ${p.receipt_number}: ${links(p.token).receipt(p.id)}\nBalance: ${m(acc.balance)}\n\nFaysha Wellness Residence`,
  });
}

/** Emails the invoice link once a proposal is accepted. */
async function emailInvoice(quoteId) {
  const q = (await db.query(`SELECT q.*, e.name, e.email, e.reference FROM event_quotes q JOIN event_requests e ON e.id = q.event_id WHERE q.id = $1`, [quoteId])).rows[0];
  if (!q?.invoice_number || !q.token) return;
  const { layout, panel, row, button } = require('./emailLayout');
  const m = (n) => formatMoney(n, q.currency);
  await require('./email.service').sendEmail({
    to: q.email,
    subject: `Invoice ${q.invoice_number} · ${q.reference}`,
    html: layout({
      title: 'Thank you — your invoice',
      intro: `Dear ${esc(q.name)}, your proposal is accepted. Your date is held once the deposit is received.`,
      body: `${panel('Invoice', `<table role="presentation" width="100%">${row('Invoice', esc(q.invoice_number))}${row('Total', esc(m(q.total)))}${row('Deposit to confirm the date', esc(m(q.deposit_amount)))}</table>`)}
        <div style="text-align:center;margin-top:20px">${button(links(q.token).proposal, 'Pay the deposit')}</div>
        <p style="font:13px/1.6 Arial,sans-serif;color:#a49d90;text-align:center;margin-top:14px">Pay only from your proposal page or to the team at the residence: every payment gets an official receipt. <a href="${esc(links(q.token).invoice)}" style="color:#e8b84a">View the invoice</a></p>`,
    }),
    text: `Dear ${q.name},\n\nInvoice ${q.invoice_number}: total ${m(q.total)}, deposit ${m(q.deposit_amount)}.\nPay from your proposal page: ${links(q.token).proposal}\nInvoice: ${links(q.token).invoice}\n\nFaysha Wellness Residence`,
  });
}

module.exports = { ensureInvoice, ensureReceipt, account, invoiceHtml, receiptHtml, emailReceipt, emailInvoice, links, METHOD };
