const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String },
  photoURL: { type: String, default: '' },
  mobileNo: { type: String, default: '' },
  upiId: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  balancePaise: { type: Number, default: 0 },
  totalEarnedPaise: { type: Number, default: 0 },
  totalWithdrawnPaise: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'blocked'], default: 'active' },
  verified: { type: Boolean, default: false },
  googleId: { type: String },
  firebaseUid: { type: String, unique: true, sparse: true },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password (handles users without a password, e.g. Firebase-only users)
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);