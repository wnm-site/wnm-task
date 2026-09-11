const Transaction = require('../models/Transaction');
const User = require('../models/User');

// @desc    Credit reward to user
// @route   POST /api/wallet/credit
const creditReward = async (userId, amountPaise, type, referenceId = '') => {
  if (amountPaise <= 0) return null;

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (user.status === 'blocked') throw new Error('Account blocked');

  user.balancePaise += amountPaise;
  user.totalEarnedPaise += amountPaise;
  await user.save();

  const transaction = await Transaction.create({
    userId,
    type,
    amountPaise,
    balanceAfterPaise: user.balancePaise,
    referenceId,
  });

  return { transaction, newBalance: user.balancePaise };
};

// @desc    Debit balance from user
// @route   POST /api/wallet/debit
const debitBalance = async (userId, amountPaise, type, referenceId = '') => {
  if (amountPaise <= 0) throw new Error('Invalid amount');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (user.balancePaise < amountPaise) throw new Error('Insufficient balance');

  user.balancePaise -= amountPaise;
  await user.save();

  const transaction = await Transaction.create({
    userId,
    type,
    amountPaise: -amountPaise,
    balanceAfterPaise: user.balancePaise,
    referenceId,
  });

  return { transaction, newBalance: user.balancePaise };
};

// @desc    Get user transactions
// @route   GET /api/wallet/transactions
const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Credit reward to the authenticated user
// @route   POST /api/wallet/credit
const creditRewardRoute = async (req, res) => {
  try {
    const { amountPaise, type, referenceId } = req.body;
    if (!amountPaise || amountPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }
    if (!type) {
      return res.status(400).json({ success: false, message: 'Type is required' });
    }

    const result = await creditReward(req.user._id, amountPaise, type, referenceId || '');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { creditReward, debitBalance, getTransactions, creditRewardRoute };