const express = require('express');
const router = express.Router();
const { getTransactions, creditRewardRoute } = require('../controllers/walletController');
const { requestWithdrawal, getUserWithdrawals } = require('../controllers/withdrawalController');
const protect = require('../middleware/auth');

router.get('/transactions', protect, getTransactions);
router.post('/credit', protect, creditRewardRoute);
router.get('/withdrawals', protect, getUserWithdrawals);
router.post('/withdrawals', protect, requestWithdrawal);

module.exports = router;