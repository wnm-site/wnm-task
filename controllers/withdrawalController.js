const Withdrawal = require('../models/Withdrawal');
const Settings = require('../models/Settings');
const { debitBalance, creditReward } = require('./walletController');

const requestWithdrawal = async (req, res) => {
  try {
    const { amountPaise, method, upiId } = req.body;
    const userId = req.user._id;

    const settings = await Settings.findOne({ key: 'general' });
    const minWithdraw = settings?.data?.minWithdrawalPaise || 10000;
    const maxWithdraw = settings?.data?.maxWithdrawalPaise || 1000000;

    if (amountPaise < minWithdraw) {
      return res.status(400).json({ success: false, message: `Minimum withdrawal is ₹${minWithdraw / 100}` });
    }
    if (amountPaise > maxWithdraw) {
      return res.status(400).json({ success: false, message: `Maximum withdrawal is ₹${maxWithdraw / 100}` });
    }

    const pending = await Withdrawal.findOne({ userId, status: 'pending' });
    if (pending) {
      return res.status(400).json({ success: false, message: 'You already have a pending withdrawal' });
    }

    await debitBalance(userId, amountPaise, 'withdrawal');

    const withdrawal = await Withdrawal.create({
      userId,
      amountPaise,
      method: method || 'upi',
      upiId,
    });

    res.status(201).json({ success: true, data: withdrawal });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

const getUserWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: withdrawals });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const adminGetWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: withdrawals });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const adminApproveWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id).populate('userId');
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Not found' });
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Already processed' });
    }

    withdrawal.status = 'approved';
    await withdrawal.save();

    const user = withdrawal.userId;
    user.totalWithdrawnPaise += withdrawal.amountPaise;
    await user.save();

    res.json({ success: true, message: 'Withdrawal approved' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const adminRejectWithdrawal = async (req, res) => {
  try {
    const { adminNote } = req.body;
    const withdrawal = await Withdrawal.findById(req.params.id).populate('userId');
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Not found' });
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Already processed' });
    }

    withdrawal.status = 'rejected';
    withdrawal.adminNote = adminNote || '';
    await withdrawal.save();

    // Reverse the debit
    await creditReward(withdrawal.userId._id, withdrawal.amountPaise, 'withdrawal_reversal', withdrawal._id.toString());

    res.json({ success: true, message: 'Withdrawal rejected and balance reversed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  requestWithdrawal, getUserWithdrawals,
  adminGetWithdrawals, adminApproveWithdrawal, adminRejectWithdrawal,
};