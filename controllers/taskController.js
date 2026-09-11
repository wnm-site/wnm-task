const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { creditReward } = require('./walletController');

// @desc    Get active tasks
// @route   GET /api/tasks
const getActiveTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
const getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Submit task proof
// @route   POST /api/tasks/:id/submit
const submitTask = async (req, res) => {
  try {
    const { proofData, proofType } = req.body;
    const taskId = req.params.id;
    const userId = req.user._id;

    const task = await Task.findById(taskId);
    if (!task || task.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Task not available' });
    }

    // Check if already approved
    const existing = await TaskSubmission.findOne({ taskId, userId, status: 'approved' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Already completed this task' });
    }

    // Check max submissions
    if (task.maxSubmissions) {
      const count = await TaskSubmission.countDocuments({ taskId, userId });
      if (count >= task.maxSubmissions) {
        return res.status(400).json({ success: false, message: 'Maximum submissions reached' });
      }
    }

    const submission = await TaskSubmission.create({
      taskId,
      userId,
      proofData,
      proofType: proofType || task.proofType,
      rewardPaise: task.rewardPaise,
    });

    res.status(201).json({ success: true, data: submission });
  } catch (error) {
    console.error('Submit task error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Get all tasks
// @route   GET /api/admin/tasks
const adminGetTasks = async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Create task
// @route   POST /api/admin/tasks
const adminCreateTask = async (req, res) => {
  try {
    const task = await Task.create(req.body);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Update task
// @route   PUT /api/admin/tasks/:id
const adminUpdateTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Delete task
// @route   DELETE /api/admin/tasks/:id
const adminDeleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get user's own submissions
// @route   GET /api/tasks/submissions
const getUserSubmissions = async (req, res) => {
  try {
    const submissions = await TaskSubmission.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get user's submission for a specific task
// @route   GET /api/tasks/:id/submission
const getUserSubmission = async (req, res) => {
  try {
    const submission = await TaskSubmission.findOne({
      taskId: req.params.id,
      userId: req.user._id,
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: submission });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Get submissions — full history, optionally filtered by status
// @route   GET /api/admin/submissions?status=pending|approved|rejected|all
const adminGetSubmissions = async (req, res) => {
  try {
    const { status } = req.query;
    const validStatuses = ['pending', 'approved', 'rejected'];
    const filter = validStatuses.includes(status) ? { status } : {};
    const submissions = await TaskSubmission.find(filter)
      .populate('taskId', 'title')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Delete a submission (reverses reward if it was already approved)
// @route   DELETE /api/admin/submissions/:id
const adminDeleteSubmission = async (req, res) => {
  try {
    const submission = await TaskSubmission.findById(req.params.id);
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });

    // If the reward was already credited, reverse it to keep the ledger consistent
    if (submission.status === 'approved') {
      const user = await User.findById(submission.userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      if (user.balancePaise < submission.rewardPaise) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete: user has already spent this reward. Block the user to prevent abuse.',
        });
      }

      user.balancePaise -= submission.rewardPaise;
      user.totalEarnedPaise = Math.max(0, user.totalEarnedPaise - submission.rewardPaise);
      await user.save();

      await Transaction.create({
        userId: submission.userId,
        type: 'task_reward_reversal',
        amountPaise: -submission.rewardPaise,
        balanceAfterPaise: user.balancePaise,
        referenceId: submission._id.toString(),
      });
    }

    await submission.deleteOne();
    res.json({ success: true, message: 'Submission deleted' });
  } catch (error) {
    console.error('Delete submission error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Approve submission
// @route   POST /api/admin/submissions/:id/approve
const adminApproveSubmission = async (req, res) => {
  try {
    const submission = await TaskSubmission.findById(req.params.id).populate('taskId');
    if (!submission) return res.status(404).json({ success: false, message: 'Not found' });
    if (submission.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Already processed' });
    }

    submission.status = 'approved';
    await submission.save();

    await creditReward(submission.userId, submission.rewardPaise, 'task_reward', submission._id.toString());

    res.json({ success: true, message: 'Approved and reward credited' });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Reject submission
// @route   POST /api/admin/submissions/:id/reject
const adminRejectSubmission = async (req, res) => {
  try {
    const { reason } = req.body;
    const submission = await TaskSubmission.findById(req.params.id);
    if (!submission) return res.status(404).json({ success: false, message: 'Not found' });

    submission.status = 'rejected';
    submission.rejectionReason = reason || '';
    await submission.save();

    res.json({ success: true, message: 'Rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getActiveTasks, getTask, submitTask, getUserSubmissions, getUserSubmission,
  adminGetTasks, adminCreateTask, adminUpdateTask, adminDeleteTask,
  adminGetSubmissions, adminApproveSubmission, adminRejectSubmission, adminDeleteSubmission,
};