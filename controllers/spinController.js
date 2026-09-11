const Spin = require('../models/Spin');
const Settings = require('../models/Settings');
const { creditReward } = require('./walletController');

const DEFAULT_REWARDS = [
  { paise: 0, weight: 40, label: '₹0' },
  { paise: 50, weight: 25, label: '₹0.50' },
  { paise: 100, weight: 15, label: '₹1' },
  { paise: 200, weight: 10, label: '₹2' },
  { paise: 500, weight: 7, label: '₹5' },
  { paise: 1000, weight: 3, label: '₹10' },
];

const todayKey = () => new Date().toISOString().split('T')[0];

const getSpinSettingsDoc = async () => {
  const doc = await Settings.findOne({ key: 'spin' });
  const data = doc?.data || {};
  return {
    enabled: data.enabled !== false,
    dailyLimit: Math.max(1, parseInt(data.dailyLimit, 10) || 3),
    adEnabled: data.adEnabled !== false,
    adDailyLimit: Math.max(1, parseInt(data.adDailyLimit, 10) || 1),
    rewards: Array.isArray(data.rewards) && data.rewards.length > 0 ? data.rewards : DEFAULT_REWARDS,
  };
};

// ── POST /api/spin/spin ─────────────────────────────────────────
const performSpin = async (req, res) => {
  try {
    const userId = req.user._id;
    const dayKey = todayKey();
    const settings = await getSpinSettingsDoc();

    if (!settings.enabled) {
      return res.status(400).json({ success: false, message: 'Spin is currently disabled' });
    }

    const [freeUsed, adUsed] = await Promise.all([
      Spin.countDocuments({ userId, dayKey, type: 'free' }),
      Spin.countDocuments({ userId, dayKey, type: 'ad' }),
    ]);

    const totalAllowed = settings.dailyLimit + Math.min(adUsed, settings.adDailyLimit);
    if (freeUsed >= totalAllowed) {
      return res.status(400).json({ success: false, message: 'Daily spin limit reached' });
    }

    // Weighted random selection
    const rewards = settings.rewards;
    const totalWeight = rewards.reduce((s, r) => s + (parseInt(r.weight, 10) || 0), 0);
    if (totalWeight <= 0) {
      return res.status(500).json({ success: false, message: 'Invalid spin configuration' });
    }

    let rand = Math.random() * totalWeight;
    let selectedIndex = rewards.length - 1;
    for (let i = 0; i < rewards.length; i++) {
      rand -= parseInt(rewards[i].weight, 10) || 0;
      if (rand <= 0) { selectedIndex = i; break; }
    }

    const rewardPaise = parseInt(rewards[selectedIndex].paise, 10) || 0;
    const label = rewards[selectedIndex].label || `₹${(rewardPaise / 100).toFixed(2)}`;
    console.log(`[SPIN] user=${userId} day=${dayKey} idx=${selectedIndex} paise=${rewardPaise} "${label}"`);

    const record = await Spin.create({
      userId, dayKey, type: 'free', rewardIndex: selectedIndex, rewardPaise,
    });

    let newBalance = null;
    if (rewardPaise > 0) {
      const credited = await creditReward(userId, rewardPaise, 'spin_reward', record._id.toString());
      newBalance = credited.newBalance;
    }

    res.json({
      success: true,
      data: {
        rewardIndex: selectedIndex,
        rewardPaise,
        label,
        totalSegments: rewards.length,
        spinsLeft: Math.max(0, totalAllowed - freeUsed - 1),
        totalAllowed,
        newBalance,
      },
    });
  } catch (error) {
    console.error('Spin error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/spin/settings ──────────────────────────────────────
const getSpinSettingsRoute = async (_req, res) => {
  try {
    const settings = await getSpinSettingsDoc();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get spin settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/spin/state ─────────────────────────────────────────
const getSpinStateRoute = async (req, res) => {
  try {
    const userId = req.user._id;
    const dayKey = todayKey();
    const settings = await getSpinSettingsDoc();

    const [freeUsed, adUsed] = await Promise.all([
      Spin.countDocuments({ userId, dayKey, type: 'free' }),
      Spin.countDocuments({ userId, dayKey, type: 'ad' }),
    ]);

    const totalAllowed = settings.dailyLimit + Math.min(adUsed, settings.adDailyLimit);

    res.json({
      success: true,
      data: {
        enabled: settings.enabled,
        dailyLimit: settings.dailyLimit,
        freeUsed,
        spinsLeft: Math.max(0, totalAllowed - freeUsed),
        totalAllowed,
        adUsed,
        adLimit: settings.adDailyLimit,
        canWatchAd: settings.adEnabled && adUsed < settings.adDailyLimit,
      },
    });
  } catch (error) {
    console.error('Get spin state error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/spin/watch-ad ─────────────────────────────────────
const watchAdForExtraSpin = async (req, res) => {
  try {
    const userId = req.user._id;
    const dayKey = todayKey();
    const settings = await getSpinSettingsDoc();

    if (!settings.enabled) {
      return res.status(400).json({ success: false, message: 'Spin is currently disabled' });
    }
    if (!settings.adEnabled) {
      return res.status(400).json({ success: false, message: 'Ad rewards are disabled' });
    }

    const adUsed = await Spin.countDocuments({ userId, dayKey, type: 'ad' });
    if (adUsed >= settings.adDailyLimit) {
      return res.status(400).json({ success: false, message: 'You already watched an ad today' });
    }

    await Spin.create({ userId, dayKey, type: 'ad', rewardPaise: 0, rewardIndex: -1 });

    const newAdUsed = adUsed + 1;
    const freeUsed = await Spin.countDocuments({ userId, dayKey, type: 'free' });
    const totalAllowed = settings.dailyLimit + Math.min(newAdUsed, settings.adDailyLimit);

    res.json({
      success: true,
      data: {
        adUsed: newAdUsed,
        adLimit: settings.adDailyLimit,
        spinsLeft: Math.max(0, totalAllowed - freeUsed),
        totalAllowed,
      },
    });
  } catch (error) {
    console.error('Ad watch error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { performSpin, watchAdForExtraSpin, getSpinSettingsRoute, getSpinStateRoute };