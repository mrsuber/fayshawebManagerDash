/**
 * Manager dashboard API — mounted at /api/manager.
 * Every route requires a signed-in manager or super administrator.
 * Contract: frontend/src/manager/docs/API.md
 */

const express = require('express');
const { authenticateToken, requireRole, checkPasswordChangeRequired } = require('../../middleware/auth');
const guests = require('./guests');
const conversations = require('./conversations');
const serviceRequests = require('./serviceRequests');
const reservations = require('./reservations');
const residences = require('./residences');
const departments = require('./departments');
const operations = require('./operations');
const admin = require('./admin');

const router = express.Router();

router.use(authenticateToken, checkPasswordChangeRequired, requireRole('manager', 'superadmin'));

router.use('/guests', guests.router);
router.use('/conversations', conversations.router);
router.use('/service-requests', serviceRequests);
router.use('/reservations', reservations);
router.use('/residences', residences.router);
router.use('/housekeeping', residences.housekeeping);
router.use(departments.router);
router.use(operations);
router.use(admin);

router.use((req, res) => res.status(404).json({ message: `No manager route ${req.method} ${req.path}` }));

// Errors render as { message } (the dashboard shows it in a toast).
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  const pgClient = { '23505': [409, 'That already exists'], '23503': [400, 'A linked record does not exist'], '22P02': [400, 'Invalid value'], '22007': [400, 'Invalid date'], '23514': [400, 'A value is out of range'] };
  const [status, message] = err.status ? [err.status, err.message] : pgClient[err.code] || [500, 'Something went wrong'];
  if (status >= 500) console.error('Manager API error:', req.method, req.originalUrl, err);
  res.status(status).json({ message });
});

module.exports = router;
