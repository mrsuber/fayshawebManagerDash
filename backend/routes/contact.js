const express = require('express');
const db = require('../config/database');
const emailService = require('../services/email.service');
const { alertManagers } = require('../services/stayKeys');

const router = express.Router();

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Website contact form. The enquiry is saved for follow-up in FAY OS (Enquiries) and raised to managers;
 * the team inbox (CONTACT_EMAIL, else EMAIL_FROM) also gets a copy when email is configured. Saving never depends
 * on email, so nothing is lost when the mail server is down.
 */
router.post('/', async (req, res) => {
  const { name, email, phone, subject, message, website } = req.body || {};

  // Honeypot: the form has a hidden "website" field people never fill in.
  if (website) return res.json({ success: true });

  if (!String(name || '').trim() || !String(email || '').trim() || !String(message || '').trim()) {
    return res.status(400).json({ success: false, message: 'Name, email and message are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address' });
  }
  if (String(message).length > 5000) {
    return res.status(400).json({ success: false, message: 'Message is too long' });
  }

  try {
    const clean = {
      name: String(name).trim().slice(0, 255),
      email: String(email).trim().toLowerCase().slice(0, 255),
      phone: phone ? String(phone).trim().slice(0, 50) : null,
      subject: subject ? String(subject).trim().slice(0, 255) : null,
      message: String(message).trim(),
    };
    const { rows } = await db.query(
      `INSERT INTO enquiries (name, email, phone, subject, message, source, ip, user_id)
       VALUES ($1, $2::text, $3, $4, $5, $6, $7, (SELECT id FROM users WHERE lower(email) = $2::text AND deleted_at IS NULL LIMIT 1))
       RETURNING id`,
      [clean.name, clean.email, clean.phone, clean.subject, clean.message, req.body.source === 'app' ? 'app' : 'website', req.ip],
    );
    const id = rows[0].id;
    await alertManagers(req.app, 'New enquiry', `${clean.name}: ${clean.subject || clean.message.slice(0, 80)}`, `/enquiries?id=${id}`);
    const io = req.app.get('io');
    if (io) io.to('staff').emit('enquiry:created', { id });

    // A copy to the team inbox, best effort.
    const to = process.env.CONTACT_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_USER;
    if (to && emailService.configured) {
      emailService
        .sendEmail({
          to,
          replyTo: clean.email,
          subject: `Website enquiry: ${String(clean.subject || 'General').slice(0, 120)}`,
          text: `From: ${clean.name} <${clean.email}>\nPhone: ${clean.phone || '-'}\nSubject: ${clean.subject || '-'}\n\n${clean.message}\n\nFollow up in FAY OS → Enquiries.`,
          html: `<p><strong>From:</strong> ${escapeHtml(clean.name)} &lt;${escapeHtml(clean.email)}&gt;</p>
            <p><strong>Phone:</strong> ${escapeHtml(clean.phone || '-')}</p>
            <p><strong>Subject:</strong> ${escapeHtml(clean.subject || '-')}</p>
            <p style="white-space:pre-wrap">${escapeHtml(clean.message)}</p>
            <p style="color:#888">Follow up in FAY OS → Enquiries.</p>`,
        })
        .catch((e) => console.error('Contact form copy email failed:', e.message));
    }
    res.status(201).json({ success: true, id });
  } catch (error) {
    console.error('Contact form failed:', error);
    res.status(500).json({ success: false, message: 'We could not send your message. Please call or email us.' });
  }
});

module.exports = router;
