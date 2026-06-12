require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const axios = require('axios');

const app = express();

// ==================== MIDDLEWARE ====================
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8081'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==================== MONGODB CONNECTION ====================
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/finance_tracker';

mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ==================== DATABASE SCHEMAS ====================
const { Schema } = mongoose;

// User Schema
const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String },
  country: { type: String },
  username: { type: String, unique: true, sparse: true },
  passwordHash: { type: String },
  googleId: { type: String, sparse: true },
  githubId: { type: String, sparse: true },
  authProvider: { type: String, enum: ['local', 'google', 'github'], default: 'local' },
  profilePicture: { type: String },
  currency: { type: String, default: 'INR' },
  preferredCurrencies: { type: [String], default: ['INR', 'USD', 'EUR'] },
  lastBackup: { type: Date },
  backupFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Transaction Schema
const transactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['income', 'expense', 'transfer'], required: true },
  amount: { type: Number, required: true },
  category: { type: String },
  description: { type: String },
  date: { type: Date, default: Date.now },
  receipt: { type: String },
  paymentMethod: { type: String, enum: ['cash', 'card', 'upi', 'bank', 'other'], default: 'cash' },
  tags: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Budget Schema
const budgetSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  spent: { type: Number, default: 0 },
  period: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], default: 'monthly' },
  month: { type: String }, // YYYY-MM format
  alert: { type: Boolean, default: true },
  alertThreshold: { type: Number, default: 80 }, // Alert when 80% spent
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Goal Schema
const goalSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String },
  target: { type: Number, required: true },
  current: { type: Number, default: 0 },
  targetDate: { type: Date },
  category: { type: String },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, { timestamps: true });

// Bank Account Schema
const bankAccountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifscCode: { type: String },
  accountHolder: { type: String },
  accountType: { type: String, enum: ['savings', 'current', 'other'], default: 'savings' },
  balance: { type: Number, default: 0 },
  isLinked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// UPI Details Schema
const upiDetailsSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  upiId: { type: String, required: true },
  upiProvider: { type: String }, // Google Pay, PhonePe, etc.
  mobileNumber: { type: String },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// User Data Snapshot Schema (for web sync)
const userDataSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  db: { type: Schema.Types.Mixed, default: {} },
  lastSyncWeb: { type: Date },
  lastSyncMobile: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Models
const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Budget = mongoose.model('Budget', budgetSchema);
const Goal = mongoose.model('Goal', goalSchema);
const BankAccount = mongoose.model('BankAccount', bankAccountSchema);
const UPIDetails = mongoose.model('UPIDetails', upiDetailsSchema);
const UserData = mongoose.model('UserData', userDataSchema);

// ==================== AUTHENTICATION MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_key_change_in_production');
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ==================== AUTHENTICATION ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, country, username, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !username || !password) {
      return res.status(400).json({ error: 'Missing required fields: name, email, username, password' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    // Check existing user
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      phone,
      country,
      username,
      passwordHash,
      currency: 'INR',
      authProvider: 'local'
    });

    await newUser.save();

    // Initialize empty user data snapshot
    await UserData.create({
      userId: newUser._id,
      db: {
        users: [],
        transactions: [],
        budgets: [],
        goals: [],
        bankAccounts: [],
        upiDetails: []
      }
    });

    // Generate token
    const token = jwt.sign(
      { id: newUser._id.toString(), email: newUser.email },
      process.env.JWT_SECRET || 'dev_secret_key_change_in_production',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        currency: newUser.currency
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/username and password required' });
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash || '');
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id.toString(), email: user.email },
      process.env.JWT_SECRET || 'dev_secret_key_change_in_production',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        currency: user.currency,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// ==================== USER PROFILE ROUTES ====================

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, country, currency, profilePicture, preferredCurrencies } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name,
        phone,
        country,
        currency,
        profilePicture,
        preferredCurrencies: preferredCurrencies || undefined,
        updatedAt: new Date()
      },
      { new: true }
    ).select('-passwordHash');

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change password
app.post('/api/user/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    const user = await User.findById(req.user.id);

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash || '');
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(req.user.id, { passwordHash: hashedPassword });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TRANSACTIONS ROUTES ====================

// Get all transactions
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { type, category, startDate, endDate, limit = 50, skip = 0 } = req.query;

    let query = { userId: req.user.id };

    if (type) query.type = type;
    if (category) query.category = category;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      total,
      count: transactions.length,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create transaction
app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { type, amount, category, description, date, paymentMethod, tags } = req.body;

    if (!type || !amount || !category) {
      return res.status(400).json({ error: 'Missing required fields: type, amount, category' });
    }

    const transaction = new Transaction({
      userId: req.user.id,
      type,
      amount,
      category,
      description,
      date: date ? new Date(date) : new Date(),
      paymentMethod: paymentMethod || 'cash',
      tags: tags || []
    });

    await transaction.save();

    // Update budget spent amount
    if (type === 'expense') {
      const month = new Date(transaction.date).toISOString().slice(0, 7);
      const budget = await Budget.findOneAndUpdate(
        { userId: req.user.id, category, month },
        { $inc: { spent: amount } },
        { new: true }
      );

      // Check if budget alert threshold exceeded
      if (budget && budget.alert && (budget.spent / budget.amount * 100) >= budget.alertThreshold) {
        console.log(`⚠️ Budget alert for category: ${category}`);
      }
    }

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update transaction
app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      message: 'Transaction updated successfully',
      transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete transaction
app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== BUDGETS ROUTES ====================

// Get budgets
app.get('/api/budgets', authenticateToken, async (req, res) => {
  try {
    const budgets = await Budget.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ budgets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create budget
app.post('/api/budgets', authenticateToken, async (req, res) => {
  try {
    const { category, amount, period, alertThreshold } = req.body;

    if (!category || !amount) {
      return res.status(400).json({ error: 'Missing required fields: category, amount' });
    }

    const month = new Date().toISOString().slice(0, 7);

    const budget = new Budget({
      userId: req.user.id,
      category,
      amount,
      period: period || 'monthly',
      month,
      alertThreshold: alertThreshold || 80
    });

    await budget.save();

    res.status(201).json({
      message: 'Budget created successfully',
      budget
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update budget
app.put('/api/budgets/:id', authenticateToken, async (req, res) => {
  try {
    const budget = await Budget.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({
      message: 'Budget updated successfully',
      budget
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete budget
app.delete('/api/budgets/:id', authenticateToken, async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== GOALS ROUTES ====================

// Get goals
app.get('/api/goals', authenticateToken, async (req, res) => {
  try {
    const goals = await Goal.find({ userId: req.user.id }).sort({ targetDate: 1 });
    res.json({ goals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create goal
app.post('/api/goals', authenticateToken, async (req, res) => {
  try {
    const { name, description, target, targetDate, category, priority } = req.body;

    if (!name || !target) {
      return res.status(400).json({ error: 'Missing required fields: name, target' });
    }

    const goal = new Goal({
      userId: req.user.id,
      name,
      description,
      target,
      targetDate: targetDate ? new Date(targetDate) : null,
      category,
      priority: priority || 'medium'
    });

    await goal.save();

    res.status(201).json({
      message: 'Goal created successfully',
      goal
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update goal progress
app.put('/api/goals/:id/progress', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (amount === undefined) {
      return res.status(400).json({ error: 'Missing required field: amount' });
    }

    const goal = await Goal.findOne({ _id: req.params.id, userId: req.user.id });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    goal.current += amount;

    if (goal.current >= goal.target) {
      goal.status = 'completed';
      goal.completedAt = new Date();
    }

    await goal.save();

    res.json({
      message: 'Goal progress updated',
      goal
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete goal
app.delete('/api/goals/:id', authenticateToken, async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== BANK ACCOUNTS ROUTES ====================

// Get bank accounts
app.get('/api/bank-accounts', authenticateToken, async (req, res) => {
  try {
    const accounts = await BankAccount.find({ userId: req.user.id });
    res.json({ accounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add bank account
app.post('/api/bank-accounts', authenticateToken, async (req, res) => {
  try {
    const { bankName, accountNumber, ifscCode, accountHolder, accountType, balance } = req.body;

    if (!bankName || !accountNumber) {
      return res.status(400).json({ error: 'Missing required fields: bankName, accountNumber' });
    }

    const account = new BankAccount({
      userId: req.user.id,
      bankName,
      accountNumber,
      ifscCode,
      accountHolder,
      accountType: accountType || 'savings',
      balance: balance || 0
    });

    await account.save();

    res.status(201).json({
      message: 'Bank account added successfully',
      account
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update bank account
app.put('/api/bank-accounts/:id', authenticateToken, async (req, res) => {
  try {
    const account = await BankAccount.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    res.json({
      message: 'Bank account updated successfully',
      account
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete bank account
app.delete('/api/bank-accounts/:id', authenticateToken, async (req, res) => {
  try {
    const account = await BankAccount.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    res.json({ message: 'Bank account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== UPI ROUTES ====================

// Get UPI details
app.get('/api/upi-details', authenticateToken, async (req, res) => {
  try {
    const upiDetails = await UPIDetails.find({ userId: req.user.id });
    res.json({ upiDetails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add UPI details
app.post('/api/upi-details', authenticateToken, async (req, res) => {
  try {
    const { upiId, upiProvider, mobileNumber } = req.body;

    if (!upiId) {
      return res.status(400).json({ error: 'Missing required field: upiId' });
    }

    const upi = new UPIDetails({
      userId: req.user.id,
      upiId,
      upiProvider,
      mobileNumber
    });

    await upi.save();

    res.status(201).json({
      message: 'UPI details added successfully',
      upi
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete UPI details
app.delete('/api/upi-details/:id', authenticateToken, async (req, res) => {
  try {
    const upi = await UPIDetails.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!upi) {
      return res.status(404).json({ error: 'UPI details not found' });
    }

    res.json({ message: 'UPI details deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DASHBOARD ROUTES ====================

// Get dashboard summary
app.get('/api/dashboard/summary', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const transactions = await Transaction.find({ userId: req.user.id });
    const budgets = await Budget.find({ userId: req.user.id });
    const goals = await Goal.find({ userId: req.user.id, status: 'active' });

    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const thisMonthExpense = transactions
      .filter(t => t.type === 'expense' && t.date >= startOfMonth)
      .reduce((sum, t) => sum + t.amount, 0);

    const categoryExpenses = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + t.amount;
      });

    res.json({
      totalIncome: income,
      totalExpense: expense,
      monthExpense: thisMonthExpense,
      balance: income - expense,
      budgetCount: budgets.length,
      goalsCount: goals.length,
      categoryExpenses,
      recentTransactions: transactions.slice(0, 10),
      monthlyTrend: {
        income,
        expense,
        balance: income - expense
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CURRENCY CONVERSION ROUTES ====================

// Get exchange rates
app.get('/api/currency/rates', authenticateToken, async (req, res) => {
  try {
    const baseCurrency = req.query.base || 'USD';
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'Currency API not configured' });
    }

    const response = await axios.get(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`
    );

    res.json({
      base: baseCurrency,
      rates: response.data.conversion_rates,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch currency rates' });
  }
});

// Convert currency
app.post('/api/currency/convert', authenticateToken, async (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency } = req.body;

    if (!amount || !fromCurrency || !toCurrency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const apiKey = process.env.EXCHANGE_RATE_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'Currency API not configured' });
    }

    const response = await axios.get(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${fromCurrency}`
    );

    const rate = response.data.conversion_rates[toCurrency];

    if (!rate) {
      return res.status(400).json({ error: 'Target currency not supported' });
    }

    const convertedAmount = (amount * rate).toFixed(2);

    res.json({
      amount,
      fromCurrency,
      toCurrency,
      rate,
      convertedAmount,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DATA SYNC FOR WEB/MOBILE ====================

// Get synced data
app.get('/api/data/sync', authenticateToken, async (req, res) => {
  try {
    let userData = await UserData.findOne({ userId: req.user.id });

    if (!userData) {
      userData = await UserData.create({
        userId: req.user.id,
        db: {
          transactions: [],
          budgets: [],
          goals: [],
          bankAccounts: [],
          upiDetails: []
        }
      });
    }

    res.json({
      db: userData.db || {},
      lastSync: userData.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sync data from web/mobile
app.post('/api/data/sync', authenticateToken, async (req, res) => {
  try {
    const { db, platform } = req.body; // platform: 'web' or 'mobile'

    if (!db || typeof db !== 'object') {
      return res.status(400).json({ error: 'Invalid db payload' });
    }

    const updateData = {
      db,
      updatedAt: new Date()
    };

    if (platform === 'web') {
      updateData.lastSyncWeb = new Date();
    } else if (platform === 'mobile') {
      updateData.lastSyncMobile = new Date();
    }

    const userData = await UserData.findOneAndUpdate(
      { userId: req.user.id },
      updateData,
      { upsert: true, new: true }
    );

    res.json({
      message: 'Data synced successfully',
      db: userData.db,
      lastSync: userData.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== EXPORT/IMPORT ROUTES ====================

// Export user data as JSON
app.get('/api/export/data', authenticateToken, async (req, res) => {
  try {
    const [transactions, budgets, goals, bankAccounts, upiDetails] = await Promise.all([
      Transaction.find({ userId: req.user.id }),
      Budget.find({ userId: req.user.id }),
      Goal.find({ userId: req.user.id }),
      BankAccount.find({ userId: req.user.id }),
      UPIDetails.find({ userId: req.user.id })
    ]);

    const exportData = {
      version: '1.0',
      exportDate: new Date(),
      user: {
        id: req.user.id,
        email: req.user.email
      },
      data: {
        transactions,
        budgets,
        goals,
        bankAccounts,
        upiDetails
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="finance-tracker-backup-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║   🚀 Finance Tracker Backend Started           ║
║   📍 Server running on port ${PORT}              ║
║   🗄️  MongoDB connected                        ║
║   ✅ All APIs ready for web & mobile apps      ║
╚═══════════════════════════════════════════════╝
  `);
});

module.exports = app;
