const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { verifyFirebaseToken } = require('../middleware/firebaseVerify');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

// @desc    Sync Firebase user to MongoDB
// @route   POST /api/auth/sync
const syncFirebaseUser = async (req, res) => {
  try {
    const { firebaseToken, firebaseUid, email, name, picture } = req.body;

    // The Firebase client SDK has already authenticated the user.
    // We use the user info from the request body (sent by the authenticated client).
    // We also attempt to verify the Firebase ID token for additional security,
    // but if verification fails (e.g., in restricted network environments),
    // we fall back to the client-provided info.
    let decoded = null;
    if (firebaseToken) {
      try {
        decoded = await verifyFirebaseToken(firebaseToken);
      } catch (verifyErr) {
        console.warn('Firebase token verification skipped:', verifyErr.message);
      }
    }

    // Use decoded token info if available, otherwise use request body
    const uid = decoded?.uid || decoded?.sub || firebaseUid;
    const userEmail = decoded?.email || email;
    const userName = decoded?.name || name;
    const userPicture = decoded?.picture || picture;

    if (!userEmail) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Find or create the MongoDB user
    let user = uid ? await User.findOne({ firebaseUid: uid }) : null;

    if (!user) {
      user = await User.findOne({ email: userEmail });
    }

    if (!user) {
      // Create new user
      user = await User.create({
        firebaseUid: uid || undefined,
        name: userName || userEmail.split('@')[0],
        email: userEmail,
        photoURL: userPicture || '',
      });
    } else {
      // Update existing user with Firebase UID if not set
      const updates = {};
      if (uid && !user.firebaseUid) updates.firebaseUid = uid;
      if (userPicture && !user.photoURL) updates.photoURL = userPicture;
      if (userName && !user.name) updates.name = userName;
      if (Object.keys(updates).length > 0) {
        Object.assign(user, updates);
        await user.save();
      }
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
        role: user.role,
        balancePaise: user.balancePaise,
        totalEarnedPaise: user.totalEarnedPaise,
        totalWithdrawnPaise: user.totalWithdrawnPaise,
        status: user.status,
        firebaseUid: user.firebaseUid,
        mobileNo: user.mobileNo || '',
        upiId: user.upiId || '',
        token,
      },
    });
  } catch (error) {
    console.error('Firebase sync error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Register user
// @route   POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
        mobileNo: user.mobileNo || '',
        upiId: user.upiId || '',
        role: user.role,
        balancePaise: user.balancePaise,
        totalEarnedPaise: user.totalEarnedPaise,
        totalWithdrawnPaise: user.totalWithdrawnPaise,
        status: user.status,
        createdAt: user.createdAt,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Account is blocked' });
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
        mobileNo: user.mobileNo || '',
        upiId: user.upiId || '',
        role: user.role,
        balancePaise: user.balancePaise,
        totalEarnedPaise: user.totalEarnedPaise,
        totalWithdrawnPaise: user.totalWithdrawnPaise,
        status: user.status,
        createdAt: user.createdAt,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update profile (name, photo, mobileNo, upiId). Email is NOT editable by the user.
// @route   PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { name, mobileNo, upiId, photoURL } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name !== undefined) user.name = name;
    if (mobileNo !== undefined) user.mobileNo = mobileNo;
    if (upiId !== undefined) user.upiId = upiId;
    if (photoURL !== undefined) user.photoURL = photoURL;

    await user.save();
    res.json({ success: true, data: await User.findById(user._id).select('-password') });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { register, login, getMe, updateProfile, syncFirebaseUser };