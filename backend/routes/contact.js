const express = require('express');
const router = express.Router();
const emailService = require('../services/email.service');

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Website contact form: forwards the message to the team inbox (CONTACT_EMAIL, else EMAIL_FROM).
router.post('/', async (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Name, email and message are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address' });
  }
  if (String(message).length > 5000) {
    return res.status(400).json({ success: false, message: 'Message is too long' });
  }

  const to = process.env.CONTACT_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_USER;
  if (!to) {
    return res.status(503).json({ success: false, message: 'Contact form is not configured' });
  }

  try {
    await emailService.sendEmail({
      to,
      subject: `Website enquiry: ${String(subject || 'General').slice(0, 120)}`,
      text: `From: ${name} <${email}>\nPhone: ${phone || '-'}\nSubject: ${subject || '-'}\n\n${message}`,
      html: `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone || '-')}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject || '-')}</p>
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Contact form email failed:', error.message);
    res.status(502).json({ success: false, message: 'We could not send your message. Please call or email us.' });
  }
});

module.exports = router;
