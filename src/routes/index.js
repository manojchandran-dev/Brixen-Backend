const { Router } = require('express');
const v1Routes = require('./v1');
const notFound = require('../middleware/notFound');

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/v1', v1Routes);
router.use('*', notFound);

module.exports = router;
