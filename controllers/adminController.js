const User = require('../models/User');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');



// @desc    Admin: Get dashboard stats
// @route   GET /api/admin/dashboard
const getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const totalTasks = await Task.countDocuments({ status: 'active' });
    const pendingSubmissions = await TaskSubmission.countDocuments({ status: 'pending' });
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });

    const totalRewardsAgg = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalEarnedPaise' } } }
    ]);
    const totalRewards = totalRewardsAgg[0]?.total || 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalTasks,
        pendingSubmissions,
        pendingWithdrawals,
        totalRewards,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Get all users
// @route   GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Get single user
// @route   GET /api/admin/users/:id
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Update user status (block/unblock)
// @route   PUT /api/admin/users/:id/status
const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.status = status;
    await user.save();

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Get all transactions
// @route   GET /api/admin/transactions
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Get settings by key
// @route   GET /api/admin/settings/:key
const getSettings = async (req, res) => {
  try {
    const { key } = req.params
    const settings = await Settings.findOne({ key })
    res.json({ 
      success: true, 
      data: settings?.data || null 
    })
  } catch (error) {
    console.error('Get settings error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

const updateSettings = async (req, res) => {
  try {
    const { key } = req.params
    const settings = await Settings.findOneAndUpdate(
      { key },
      { key, data: req.body },
      { upsert: true, new: true }
    )
    res.json({ 
      success: true, 
      data: settings.data,
      message: 'Settings updated successfully'
    })
  } catch (error) {
    console.error('Update settings error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

// @desc    Admin: Update user (name, email, role, status, verified, mobileNo, upiId, photo)
// @route   PUT /api/admin/users/:id
const updateUser = async (req, res) => {
  try {
    const { name, email, role, status, verified, mobileNo, upiId, photoURL } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (status !== undefined) user.status = status;
    if (typeof verified === 'boolean') user.verified = verified;
    if (mobileNo !== undefined) user.mobileNo = mobileNo;
    if (upiId !== undefined) user.upiId = upiId;
    // photoURL: accepts a base64 data-URL to set/change the photo, or '' to remove it
    if (photoURL !== undefined) user.photoURL = photoURL;

    await user.save();
    res.json({ success: true, data: await User.findById(user._id).select('-password') });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Delete user
// @route   DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Adjust a user's balance / earnings (add or subtract) with a note
// @route   POST /api/admin/users/:id/balance
const adjustUserBalance = async (req, res) => {
  try {
    const { amountPaise, type, note, referenceId } = req.body;

    const amount = Math.round(Number(amountPaise));
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid amount greater than 0' });
    }
    if (!note || !String(note).trim()) {
      return res.status(400).json({ success: false, message: 'A note is required for this adjustment' });
    }

    const isDebit = type === 'admin_debit';
    const txnType = isDebit ? 'admin_debit' : 'admin_credit';

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (isDebit && user.balancePaise < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance for this deduction' });
    }

    if (isDebit) {
      user.balancePaise -= amount;
    } else {
      user.balancePaise += amount;
      user.totalEarnedPaise += amount;
    }
    await user.save();

    const transaction = await Transaction.create({
      userId: user._id,
      type: txnType,
      amountPaise: isDebit ? -amount : amount,
      balanceAfterPaise: user.balancePaise,
      referenceId: referenceId || note || '',
    });

    res.status(201).json({
      success: true,
      data: { user: await User.findById(user._id).select('-password'), transaction },
      message: isDebit ? 'Balance deducted' : 'Earnings added',
    });
  } catch (error) {
    console.error('Adjust balance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Get a single user's transaction (earning) history
// @route   GET /api/admin/users/:id/transactions
const getUserTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Delete a transaction entry and reverse its effect on the wallet
// @route   DELETE /api/admin/transactions/:id
const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });

    if (transaction.type === 'admin_reversal') {
      return res.status(400).json({ success: false, message: 'Reversal records cannot be deleted' });
    }
    if (transaction.type === 'withdrawal') {
      return res.status(400).json({ success: false, message: 'Withdrawal entries cannot be deleted (money already paid out)' });
    }

    const user = await User.findById(transaction.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const amount = transaction.amountPaise;

    if (amount > 0) {
      // Deleting a credit: take the credited amount back out of the wallet
      if (user.balancePaise < amount) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete this entry — the user has already spent the credited amount',
        });
      }
      user.balancePaise -= amount;
      user.totalEarnedPaise = Math.max(0, user.totalEarnedPaise - amount);
    } else {
      // Deleting a debit: give the amount back to the wallet
      user.balancePaise += Math.abs(amount);
    }

    await user.save();

    // Record a compensating reversal entry, then remove the original
    await Transaction.create({
      userId: user._id,
      type: 'admin_reversal',
      amountPaise: -amount,
      balanceAfterPaise: user.balancePaise,
      referenceId: transaction._id.toString(),
    });
    await Transaction.deleteOne({ _id: transaction._id });

    res.json({
      success: true,
      data: await User.findById(user._id).select('-password'),
      message: 'Transaction deleted and balance adjusted',
    });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getDashboard, getAllUsers, getUserById, updateUserStatus, updateUser, deleteUser,
  getAllTransactions, getSettings, updateSettings,
  adjustUserBalance, getUserTransactions, deleteTransaction,
};
