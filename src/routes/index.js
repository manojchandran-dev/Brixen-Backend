const { Router } = require('express');
const v1Routes = require('./v1');
const notFound = require('../middleware/notFound.middleware');
const { healthReport } = require('../utils/health');

const router = Router();

// Public, for uptime monitoring and the app's warm-up ping. Same block as the
// superadmin dashboard's health; 503 when the database is down.
router.get('/health', async (req, res) => {
  const health = await healthReport(Date.now());
  const status = Object.values(health).every((h) => h.status === 'ok') ? 'ok' : 'degraded';
  res.status(health.database.status === 'down' ? 503 : 200).json({ status, ...health });
});

router.use('/v1', v1Routes);
router.use('*', notFound);

module.exports = router;
