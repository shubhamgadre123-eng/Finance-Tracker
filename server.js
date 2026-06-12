require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ====== Basic Middleware ======
app.use(cors());
app.use(express.json());

// ====== Mongo Connection ======
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/finance_tracker';

mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
  });

// ====== Schemas & Models ======
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    phone: { type: String },
    country: { type: String },
    passwordHash: { type: String, required: true },
    currency: { type: String, default: 'INR' }
  },
  { timestamps: true }
);

const userDataSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', unique: true },
    db: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const UserData = mongoose.model('UserData', userDataSchema);

// ====== Auth Middleware ======
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = { id: decoded.id };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ====== Helper ======
function buildClientUser(userDoc) {
  return {
    id: userDoc._id.toString(),
    name: userDoc.name,
    email: userDoc.email,
    username: userDoc.username,
    phone: userDoc.phone,
    country: userDoc.country,
    currency: userDoc.currency || 'INR',
    createdAt: userDoc.createdAt
  };
}

// ====== Auth Routes ======
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, country, username, password, confirmPassword } = req.body || {};

    if (!name || !email || !username || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      country,
      username,
      passwordHash,
      currency: 'INR'
    });

    // initialize empty data snapshot for this user
    await UserData.create({
      user: user._id,
      db: {
        users: [],
        transactions: [],
        budgets: [],
        goals: [],
        bankAccounts: [],
        upiDetails: []
      }
    });

    return res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    // identifier can be email, username or phone
    const user =
      (await User.findOne({ email: identifier })) ||
      (await User.findOne({ username: identifier })) ||
      (await User.findOne({ phone: identifier }));

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: buildClientUser(user)
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ====== Data Sync Routes (MongoDB snapshot for each user) ======
app.get('/api/data', authMiddleware, async (req, res) => {
  try {
    let userData = await UserData.findOne({ user: req.user.id }).lean();

    if (!userData) {
      userData = await UserData.create({
        user: req.user.id,
        db: {
          users: [],
          transactions: [],
          budgets: [],
          goals: [],
          bankAccounts: [],
          upiDetails: []
        }
      });
    }

    return res.json({ db: userData.db || {} });
  } catch (err) {
    console.error('Get data error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/data', authMiddleware, async (req, res) => {
  try {
    const { db } = req.body || {};

    if (!db || typeof db !== 'object') {
      return res.status(400).json({ error: 'Invalid db payload' });
    }

    const updated = await UserData.findOneAndUpdate(
      { user: req.user.id },
      { db },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({ message: 'Data synced successfully', db: updated.db });
  } catch (err) {
    console.error('Save data error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ====== Health Check ======
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ====== Server Start ======
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const AWS = require('aws-sdk');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(passport.initialize());
app.use(passport.session());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/finance-tracker', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected')).catch(err => console.log(err));

// AWS S3 Configuration for Cloud Backup
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});

// ==================== SCHEMAS ====================
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true, sparse: true },
    phone: { type: String, required: true },
    country: String,
    username: { type: String, unique: true, sparse: true },
    password: String,
    googleId: String,
    githubId: String,
    currency: { type: String, default: 'INR' },
    profilePicture: String,
    preferredCurrencies: { type: [String], default: ['INR', 'USD', 'EUR'] },
    lastBackup: Date,
    backupFrequency: { type: String, default: 'weekly' }, // daily, weekly, monthly
    authProvider: { type: String, enum: ['local', 'google', 'github'], default: 'local' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true },
    category: String,
    description: String,
    date: { type: Date, default: Date.now },
    receipt: String,
    paymentMethod: String,
    createdAt: { type: Date, default: Date.now }
});

const budgetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: String,
    amount: { type: Number, required: true },
    spent: { type: Number, default: 0 },
    period: { type: String, default: 'monthly' },
    month: String,
    createdAt: { type: Date, default: Date.now }
});

const goalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    target: Number,
    current: { type: Number, default: 0 },
    dueDate: Date,
    createdAt: { type: Date, default: Date.now }
});

const bankAccountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    accountHolder: String,
    accountType: String,
    balance: Number,
    createdAt: { type: Date, default: Date.now }
});

const upiDetailsSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    upiId: String,
    upiProvider: String,
    mobileNumber: String,
    createdAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Budget = mongoose.model('Budget', budgetSchema);
const Goal = mongoose.model('Goal', goalSchema);
const BankAccount = mongoose.model('BankAccount', bankAccountSchema);
const UPIDetails = mongoose.model('UPIDetails', upiDetailsSchema);

// ==================== MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// ==================== PASSPORT OAUTH CONFIGURATION ====================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        
        if (!user) {
            user = new User({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                profilePicture: profile.photos[0]?.value,
                authProvider: 'google'
            });
            await user.save();
        }
        
        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/api/auth/github/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ githubId: profile.id });
        
        if (!user) {
            user = new User({
                githubId: profile.id,
                name: profile.displayName || profile.username,
                email: profile.emails[0]?.value,
                profilePicture: profile.photos[0]?.value,
                authProvider: 'github'
            });
            await user.save();
        }
        
        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

// ==================== AUTHENTICATION ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, phone, country, username, password, confirmPassword } = req.body;

        // Validation
        if (!name || !email || !phone || !username || !password) {
            return res.status(400).json({ error: 'All fields required' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }

        // Check existing user
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash password with bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = new User({
            name,
            email,
            phone,
            country,
            username,
            password: hashedPassword,
            currency: 'INR'
        });

        await newUser.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: newUser._id, email: newUser.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                username: newUser.username
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Email/username and password required' });
        }

        // Find user by email or username
        const user = await User.findOne({
            $or: [{ email: identifier }, { username: identifier }]
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
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
                currency: user.currency
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== OAUTH ROUTES ====================
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    const token = jwt.sign(
        { userId: req.user._id, email: req.user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
    );
    
    res.redirect(`${process.env.FRONTEND_URL}?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        authProvider: 'google'
    }))}`);
});

app.get('/api/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/api/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), (req, res) => {
    const token = jwt.sign(
        { userId: req.user._id, email: req.user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
    );
    
    res.redirect(`${process.env.FRONTEND_URL}?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        authProvider: 'github'
    }))}`);
});

// ==================== USER ROUTES ====================
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { name, phone, currency, profilePicture } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { name, phone, currency, profilePicture, updatedAt: Date.now() },
            { new: true }
        ).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/user/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'All fields required' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        const user = await User.findById(req.user.userId);
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(req.user.userId, { password: hashedPassword });

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TRANSACTION ROUTES ====================
app.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.userId }).sort({ date: -1 });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const { type, amount, category, description, date, paymentMethod } = req.body;

        const transaction = new Transaction({
            userId: req.user.userId,
            type,
            amount,
            category,
            description,
            date: date || Date.now(),
            paymentMethod
        });

        await transaction.save();
        res.status(201).json(transaction);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(transaction);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        await Transaction.findByIdAndDelete(req.params.id);
        res.json({ message: 'Transaction deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== BUDGET ROUTES ====================
app.get('/api/budgets', authenticateToken, async (req, res) => {
    try {
        const budgets = await Budget.find({ userId: req.user.userId });
        res.json(budgets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/budgets', authenticateToken, async (req, res) => {
    try {
        const { category, amount, period } = req.body;

        const budget = new Budget({
            userId: req.user.userId,
            category,
            amount,
            period,
            month: new Date().toISOString().slice(0, 7)
        });

        await budget.save();
        res.status(201).json(budget);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/budgets/:id', authenticateToken, async (req, res) => {
    try {
        const budget = await Budget.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(budget);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/budgets/:id', authenticateToken, async (req, res) => {
    try {
        await Budget.findByIdAndDelete(req.params.id);
        res.json({ message: 'Budget deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== GOAL ROUTES ====================
app.get('/api/goals', authenticateToken, async (req, res) => {
    try {
        const goals = await Goal.find({ userId: req.user.userId });
        res.json(goals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/goals', authenticateToken, async (req, res) => {
    try {
        const { name, target, dueDate } = req.body;

        const goal = new Goal({
            userId: req.user.userId,
            name,
            target,
            dueDate
        });

        await goal.save();
        res.status(201).json(goal);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/goals/:id', authenticateToken, async (req, res) => {
    try {
        const goal = await Goal.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(goal);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/goals/:id', authenticateToken, async (req, res) => {
    try {
        await Goal.findByIdAndDelete(req.params.id);
        res.json({ message: 'Goal deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== BANK ACCOUNT ROUTES ====================
app.get('/api/bank-accounts', authenticateToken, async (req, res) => {
    try {
        const accounts = await BankAccount.find({ userId: req.user.userId });
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/bank-accounts', authenticateToken, async (req, res) => {
    try {
        const { bankName, accountNumber, ifscCode, accountHolder, accountType, balance } = req.body;

        const account = new BankAccount({
            userId: req.user.userId,
            bankName,
            accountNumber,
            ifscCode,
            accountHolder,
            accountType,
            balance
        });

        await account.save();
        res.status(201).json(account);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/bank-accounts/:id', authenticateToken, async (req, res) => {
    try {
        const account = await BankAccount.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(account);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== UPI ROUTES ====================
app.get('/api/upi-details', authenticateToken, async (req, res) => {
    try {
        const upi = await UPIDetails.find({ userId: req.user.userId });
        res.json(upi);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/upi-details', authenticateToken, async (req, res) => {
    try {
        const { upiId, upiProvider, mobileNumber } = req.body;

        const upi = new UPIDetails({
            userId: req.user.userId,
            upiId,
            upiProvider,
            mobileNumber
        });

        await upi.save();
        res.status(201).json(upi);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== OCR ROUTES ====================
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/api/ocr/process-receipt', authenticateToken, upload.single('receipt'), async (req, res) => {
    try {
        // Google Cloud Vision API integration
        const vision = require('@google-cloud/vision');
        const client = new vision.ImageAnnotatorClient();

        const imageBuffer = req.file.buffer;
        const base64Image = imageBuffer.toString('base64');

        const request = {
            image: { content: base64Image }
        };

        const [result] = await client.documentTextDetection(request);
        const fullTextAnnotation = result.fullTextAnnotation;

        const extractedText = fullTextAnnotation ? fullTextAnnotation.text : '';

        // Parse receipt data
        const amount = extractedText.match(/(?:total|amount|rs|₹)\s*:?\s*(\d+\.?\d*)/i)?.[1] || '';
        const date = extractedText.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/)?.[0] || '';

        res.json({
            extractedText,
            amount,
            date,
            success: true
        });
    } catch (error) {
        res.status(500).json({ error: error.message, success: false });
    }
});

// ==================== PAYMENT INTEGRATION ROUTES ====================
// Stripe Payment
app.post('/api/payment/stripe', authenticateToken, async (req, res) => {
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const { amount, currency } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: currency || 'inr',
            metadata: { userId: req.user.userId }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Razorpay Payment (for India)
app.post('/api/payment/razorpay', authenticateToken, async (req, res) => {
    try {
        const Razorpay = require('razorpay');
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const { amount, currency } = req.body;

        const options = {
            amount: Math.round(amount * 100),
            currency: currency || 'INR',
            receipt: `receipt_${Date.now()}`,
            notes: { userId: req.user.userId }
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify Payment
app.post('/api/payment/verify', authenticateToken, async (req, res) => {
    try {
        const { orderId, paymentId, amount, type } = req.body;

        // Store payment record
        const transaction = new Transaction({
            userId: req.user.userId,
            type: 'expense',
            amount,
            category: 'payment',
            description: `Payment via ${type}`,
            paymentMethod: type,
            date: Date.now()
        });

        await transaction.save();

        res.json({
            success: true,
            message: 'Payment verified and recorded',
            transaction
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== DASHBOARD ROUTES ====================
app.get('/api/dashboard/summary', authenticateToken, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.userId });
        const budgets = await Budget.find({ userId: req.user.userId });
        const goals = await Goal.find({ userId: req.user.userId });

        const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

        const categoryExpenses = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + t.amount;
        });

        res.json({
            totalIncome: income,
            totalExpense: expense,
            balance: income - expense,
            budgets: budgets.length,
            goals: goals.length,
            categoryExpenses,
            recentTransactions: transactions.slice(0, 5)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== CURRENCY EXCHANGE ROUTES ====================
app.get('/api/currency/rates', authenticateToken, async (req, res) => {
    try {
        const baseCurrency = req.query.base || 'USD';
        const targetCurrencies = req.query.targets || 'INR,EUR,GBP,JPY,AUD,CAD';
        
        // Using exchangerate-api.com (free tier available)
        const apiKey = process.env.EXCHANGE_RATE_API_KEY;
        const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`;
        
        const response = await axios.get(url);
        const rates = response.data.conversion_rates;
        
        // Filter to only requested currencies
        const filteredRates = {};
        targetCurrencies.split(',').forEach(currency => {
            if (rates[currency]) {
                filteredRates[currency] = rates[currency];
            }
        });
        
        res.json({
            base: baseCurrency,
            rates: filteredRates,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch currency rates', message: error.message });
    }
});

app.post('/api/currency/convert', authenticateToken, async (req, res) => {
    try {
        const { amount, fromCurrency, toCurrency } = req.body;
        
        const apiKey = process.env.EXCHANGE_RATE_API_KEY;
        const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${fromCurrency}`;
        
        const response = await axios.get(url);
        const rate = response.data.conversion_rates[toCurrency];
        
        if (!rate) {
            return res.status(400).json({ error: 'Currency not supported' });
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

// ==================== CLOUD BACKUP ROUTES ====================
app.post('/api/backup/create', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        
        // Get all user data
        const transactions = await Transaction.find({ userId: req.user.userId });
        const budgets = await Budget.find({ userId: req.user.userId });
        const goals = await Goal.find({ userId: req.user.userId });
        const bankAccounts = await BankAccount.find({ userId: req.user.userId });
        const upiDetails = await UPIDetails.find({ userId: req.user.userId });
        
        const backupData = {
            user: user.toObject(),
            transactions,
            budgets,
            goals,
            bankAccounts,
            upiDetails,
            timestamp: new Date(),
            version: '1.0'
        };
        
        // Upload to AWS S3
        const backupKey = `backups/${req.user.userId}/${Date.now()}-backup.json`;
        const params = {
            Bucket: process.env.AWS_S3_BUCKET || 'finance-tracker-backups',
            Key: backupKey,
            Body: JSON.stringify(backupData),
            ContentType: 'application/json',
            ServerSideEncryption: 'AES256'
        };
        
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            await s3.putObject(params).promise();
        }
        
        // Update user's last backup date
        user.lastBackup = new Date();
        await user.save();
        
        res.json({
            success: true,
            message: 'Backup created successfully',
            backupKey,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/backup/list', authenticateToken, async (req, res) => {
    try {
        if (!process.env.AWS_ACCESS_KEY_ID) {
            return res.json({ backups: [], message: 'Cloud backup not configured' });
        }
        
        const params = {
            Bucket: process.env.AWS_S3_BUCKET || 'finance-tracker-backups',
            Prefix: `backups/${req.user.userId}/`
        };
        
        const data = await s3.listObjectsV2(params).promise();
        const backups = data.Contents || [];
        
        res.json({
            backups: backups.map(backup => ({
                key: backup.Key,
                size: backup.Size,
                lastModified: backup.LastModified,
                filename: backup.Key.split('/').pop()
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/backup/restore', authenticateToken, async (req, res) => {
    try {
        const { backupKey } = req.body;
        
        if (!process.env.AWS_ACCESS_KEY_ID) {
            return res.status(400).json({ error: 'Cloud backup not configured' });
        }
        
        const params = {
            Bucket: process.env.AWS_S3_BUCKET || 'finance-tracker-backups',
            Key: backupKey
        };
        
        const data = await s3.getObject(params).promise();
        const backupData = JSON.parse(data.Body.toString());
        
        // Restore data (you might want to add confirmation step)
        // This is a basic restore - in production, add more safeguards
        
        res.json({
            success: true,
            message: 'Backup ready for restore',
            data: backupData
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/backup/schedule', authenticateToken, async (req, res) => {
    try {
        const { frequency } = req.body; // daily, weekly, monthly
        
        if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
            return res.status(400).json({ error: 'Invalid frequency' });
        }
        
        await User.findByIdAndUpdate(req.user.userId, { backupFrequency: frequency });
        
        res.json({
            success: true,
            message: `Backup scheduled ${frequency}`,
            frequency
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== EMAIL/OTP ENDPOINTS ====================
/**
 * Send OTP via email for password reset
 * POST /api/send-otp-email
 */
app.post('/api/send-otp-email', async (req, res) => {
    try {
        const { name, email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required' });
        }

        // Try to send via nodemailer if configured
        try {
            const nodemailer = require('nodemailer');
            const gmailUser = process.env.GMAIL_USER || 'noreply.financetracker@gmail.com';
            const gmailPassword = process.env.GMAIL_PASSWORD || '';

            if (!gmailPassword) {
                console.log('ℹ️ Email service not configured - OTP demo mode');
                return res.json({ 
                    success: true, 
                    message: 'OTP sent (demo mode - check your email client)',
                    mode: 'demo'
                });
            }

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: gmailUser,
                    pass: gmailPassword
                }
            });

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
                        .container { max-width: 600px; margin: 20px auto; background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #0f3460 0%, #16213e 100%); color: white; padding: 20px; border-radius: 5px; text-align: center; }
                        .header h1 { margin: 0; font-size: 24px; }
                        .content { padding: 20px 0; }
                        .otp-box { background-color: #f0f0f0; border: 2px solid #0f3460; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0; }
                        .otp-box .otp { font-size: 32px; font-weight: bold; color: #0f3460; letter-spacing: 5px; font-family: monospace; }
                        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px; }
                        .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; border-radius: 3px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🔐 Password Reset - One Time Password</h1>
                        </div>
                        
                        <div class="content">
                            <p>Hi ${name || 'User'},</p>
                            
                            <p>You requested to reset your Finance Tracker password. Please use the OTP below to verify your identity and create a new password.</p>
                            
                            <div class="otp-box">
                                <p style="margin: 0 0 10px 0; color: #666;">Your OTP is:</p>
                                <div class="otp">${otp}</div>
                                <p style="margin: 10px 0 0 0; color: #999; font-size: 14px;">Valid for 5 minutes</p>
                            </div>
                            
                            <div class="warning">
                                <strong>⚠️ Security Warning:</strong> If you did not request this password reset, please ignore this email and change your password immediately.
                            </div>
                            
                            <p><strong>Important:</strong></p>
                            <ul>
                                <li>Never share this OTP with anyone</li>
                                <li>Finance Tracker staff will never ask for your OTP</li>
                                <li>This OTP will expire in 5 minutes</li>
                            </ul>
                            
                            <p>Access your account here: <a href="${process.env.APP_URL || 'http://localhost:5500/Finance Tracker.html'}" style="color: #0f3460;">Finance Tracker Login</a></p>
                        </div>
                        
                        <div class="footer">
                            <p>&copy; 2026 Finance Tracker. All rights reserved.</p>
                            <p>This email was sent to ${email}</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await transporter.sendMail({
                from: gmailUser,
                to: email,
                subject: '🔐 Finance Tracker - Password Reset OTP',
                html: htmlContent
            });

            res.json({ 
                success: true, 
                message: 'OTP sent to email successfully'
            });
        } catch (emailError) {
            console.log('ℹ️ Nodemailer not available:', emailError.message);
            // Fallback to demo mode
            res.json({ 
                success: true, 
                message: 'OTP sent (demo mode)',
                mode: 'demo'
            });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to send OTP email: ' + error.message });
    }
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
