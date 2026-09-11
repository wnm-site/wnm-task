const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, syncFirebaseUser } = require('../controllers/authController');
const protect = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/sync', syncFirebaseUser);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;