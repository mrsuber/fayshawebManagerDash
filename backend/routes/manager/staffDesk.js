/**
 * FAY OS → Team desk (/api/manager/staff-desk): the managers' side of the staff desk (services/staffDesk).
 *
 *   GET  /inbox                         team members with a conversation, newest first, unread counts
 *   GET  /messages/:staffId             the conversation (marks the team member's messages read)
 *   POST /messages/:staffId             { body, attachments?, about? }
 *   GET  /leave                         time off asked, coming up and recently decided
 *   POST /leave/:id/approve             (balance updated, the team member told)
 *   POST /leave/:id/reject              { reason }
 *   GET  /warnings                      every warning given, newest first
 *   POST /warnings                      { staffId, level: verbal | written | final, reason }
 */
const express = require('express');
const { ah, httpError } = require('./lib');
const desk = require('../../services/staffDesk');
const { staffAlert, resolve } = require('../../services/notify');
const db = require('../../config/database');

const router = express.Router();

router.get('/inbox', ah(async (req, res) => res.json(await desk.inbox())));

router.get(
  '/messages/:staffId',
  ah(async (req, res) => {
    const staffId = Number(req.params.staffId);
    await desk.markRead(staffId, false);
    const who = (await db.query('SELECT id, full_name, job_title, department FROM users WHERE id = $1', [staffId])).rows[0];
    if (!who) throw httpError(404, 'Team member not found');
    res.json({ staff: { id: who.id, name: who.full_name, jobTitle: who.job_title, department: who.department }, messages: await desk.messages(staffId) });
  }),
);

router.post(
  '/messages/:staffId',
  ah(async (req, res) => {
    const staffId = Number(req.params.staffId);
    if (staffId === req.user.id) throw httpError(400, 'Choose a team member');
    const ok = (await db.query(`SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND r.name <> 'guest'`, [staffId])).rows.length;
    if (!ok) throw httpError(400, 'Choose a team member');
    res.status(201).json(await desk.send(req.app, { staffId, sender: req.user, fromStaff: false, body: req.body?.body, attachments: req.body?.attachments, about: req.body?.about }));
  }),
);

router.get('/leave', ah(async (req, res) => res.json(await desk.leaveBoard())));

for (const decision of ['approve', 'reject']) {
  router.post(
    `/leave/:id/${decision}`,
    ah(async (req, res) => {
      const { decideLeave } = require('../leave');
      const reason = String(req.body?.reason || '').trim();
      if (decision === 'reject' && !reason) throw httpError(400, 'Give the reason: the team member reads it');
      const leave = await decideLeave(Number(req.params.id), decision === 'approve' ? 'approved' : 'rejected', req.user.id, reason || null);
      await resolve(req.app, `leave:${leave.id}`);
      const uid = (await db.query('SELECT user_id FROM employees WHERE id = $1', [leave.employee_id])).rows[0]?.user_id;
      if (uid) {
        const span = `${new Date(leave.start_date).toISOString().slice(0, 10)} → ${new Date(leave.end_date).toISOString().slice(0, 10)}`;
        await staffAlert(req.app, {
          title: decision === 'approve' ? 'Time off approved' : 'Time off not approved',
          body: decision === 'approve' ? `${span} · enjoy your time off` : `${span} · ${reason}`,
          link: '/work?tab=leave',
          level: decision === 'approve' ? 'info' : 'action',
          category: 'team',
          userId: uid,
        });
      }
      res.json({ ok: true });
    }),
  );
}

router.get('/warnings', ah(async (req, res) => res.json(await desk.allWarnings())));
router.post('/warnings', ah(async (req, res) => res.status(201).json(await desk.issueWarning(req.app, req.user, req.body || {}))));

module.exports = router;
