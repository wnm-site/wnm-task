const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  getDashboard, getAllUsers, getUserById, updateUserStatus, updateUser, deleteUser,
  getAllTransactions, getSettings, updateSettings,
  adjustUserBalance, getUserTransactions, deleteTransaction,
} = require('../controllers/adminController');
const {
  adminGetTasks, adminCreateTask, adminUpdateTask, adminDeleteTask,
  adminGetSubmissions, adminApproveSubmission, adminRejectSubmission, adminDeleteSubmission,
} = require('../controllers/taskController');
const {
  adminGetQuizzes, adminCreateQuiz, adminUpdateQuiz, adminDeleteQuiz,
} = require('../controllers/quizController');
const {
  adminGetWithdrawals, adminApproveWithdrawal, adminRejectWithdrawal,
} = require('../controllers/withdrawalController');

// Dashboard
router.get('/dashboard', protect, admin, getDashboard);

// Users
router.get('/users', protect, admin, getAllUsers);
router.get('/users/:id/transactions', protect, admin, getUserTransactions);
router.post('/users/:id/balance', protect, admin, adjustUserBalance);
router.get('/users/:id', protect, admin, getUserById);
router.put('/users/:id/status', protect, admin, updateUserStatus);
router.put('/users/:id', protect, admin, updateUser);
router.delete('/users/:id', protect, admin, deleteUser);

// Tasks
router.get('/tasks', protect, admin, adminGetTasks);
router.post('/tasks', protect, admin, adminCreateTask);
router.put('/tasks/:id', protect, admin, adminUpdateTask);
router.delete('/tasks/:id', protect, admin, adminDeleteTask);
router.get('/submissions', protect, admin, adminGetSubmissions);
router.post('/submissions/:id/approve', protect, admin, adminApproveSubmission);
router.post('/submissions/:id/reject', protect, admin, adminRejectSubmission);
router.delete('/submissions/:id', protect, admin, adminDeleteSubmission);

// Quizzes
router.get('/quizzes', protect, admin, adminGetQuizzes);
router.post('/quizzes', protect, admin, adminCreateQuiz);
router.put('/quizzes/:id', protect, admin, adminUpdateQuiz);
router.delete('/quizzes/:id', protect, admin, adminDeleteQuiz);

// Withdrawals
router.get('/withdrawals', protect, admin, adminGetWithdrawals);
router.post('/withdrawals/:id/approve', protect, admin, adminApproveWithdrawal);
router.post('/withdrawals/:id/reject', protect, admin, adminRejectWithdrawal);

// Transactions
router.get('/transactions', protect, admin, getAllTransactions);
router.delete('/transactions/:id', protect, admin, deleteTransaction);

// Settings
router.get('/settings/:key', protect, admin, getSettings);
router.put('/settings/:key', protect, admin, updateSettings);

module.exports = router;