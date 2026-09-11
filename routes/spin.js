const express = require('express');
const router = express.Router();
const {
  performSpin,
  watchAdForExtraSpin,
  getSpinSettingsRoute,
  getSpinStateRoute,
} = require('../controllers/spinController');
const protect = require('../middleware/auth');

// Public read of spin config (wheel labels/weights)
router.get('/settings', getSpinSettingsRoute);

// Authenticated endpoints
router.get('/state', protect, getSpinStateRoute);
router.post('/spin', protect, performSpin);
router.post('/watch-ad', protect, watchAdForExtraSpin);

module.exports = router;
