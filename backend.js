// ============================================
// FINANCE TRACKER - COMPLETE BACKEND
// Single file with all functionality
// ============================================

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

// ============================================
// APP INITIALIZATION
// ============================================
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/finance_tracker';

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// ============================================
// DATABASE CONNECTION
// ============================================
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
});

// ============================================
// SCHEMA DEFINITIONS
// ============================================

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, required: true, unique: true, trim: true },
    country: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    currency: { type: String, default: 'INR', enum: ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'AED'] },
    profilePicture: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.set('toJSON', {
    transform: function(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
    }
});

// Transaction Schema
const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, enum: ['income', 'expense', 'transfer'] },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, enum: ['salary', 'food', 'transport', 'shopping', 'entertainment', 'other'] },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    date: { type: Date, required: true, default: Date.now },
    paymentMethod: { type: String, enum: ['cash', 'card', 'upi', 'bank', 'other'], default: 'cash' },
    bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
    receipt: { type: String, default: null },
    tags: [{ type: String, trim: true }],
    location: { type: String, default: null },
    notes: { type: String, maxlength: 500 }
}, { timestamps: true });

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, category: 1 });

// Budget Schema
const budgetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, required: true, enum: ['food', 'transport', 'shopping', 'entertainment', 'other'] },
    amount: { type: Number, required: true, min: 0 },
    spent: { type: Number, default: 0, min: 0 },
    period: { type: String, required: true, enum: ['weekly', 'monthly', 'yearly'], default: 'monthly' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    notifications: { type: Boolean, default: true },
    threshold: { type: Number, default: 80, min: 1, max: 100 }
}, { timestamps: true });

budgetSchema.index({ userId: 1, category: 1 });

// Goal Schema
const goalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    target: { type: Number, required: true, min: 1 },
    current: { type: Number, default: 0, min: 0 },
    deadline: { type: Date, required: true },
    category: { type: String, enum: ['savings', 'investment', 'emergency', 'vacation', 'purchase', 'debt', 'other'], default: 'savings' },
    icon: { type: String, default: '🎯' },
    color: { type: String, default: '#ffc107' },
    notes: { type: String, maxlength: 500 },
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
    completedAt: { type: Date }
}, { timestamps: true });

goalSchema.index({ userId: 1, status: 1 });

// Bank Account Schema
const bankAccountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bankName: { type: String, required: true, trim: true },
    accountHolder: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    ifscCode: { type: String, required: true, uppercase: true, trim: true },
    branchName: { type: String, required: true, trim: true },
    accountType: { type: String, required: true, enum: ['Savings', 'Current', 'Salary', 'NRI'] },
    balance: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    isActive: { type: Boolean, default: true },
    upiLinked: [{
        upiId: String,
        provider: String,
        isPrimary: Boolean
    }],
    lastSynced: { type: Date }
}, { timestamps: true });

bankAccountSchema.index({ userId: 1, bankName: 1 });
bankAccountSchema.index({ ifscCode: 1 });

bankAccountSchema.set('toJSON', {
    transform: function(doc, ret) {
        if (ret.accountNumber) {
            ret.maskedAccountNumber = 'XXXX' + ret.accountNumber.slice(-4);
        }
        return ret;
    }
});

// Create models
const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Budget = mongoose.model('Budget', budgetSchema);
const Goal = mongoose.model('Goal', goalSchema);
const BankAccount = mongoose.model('BankAccount', bankAccountSchema);

// ============================================
// AUTH MIDDLEWARE
// ============================================
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ error: 'User not found' });
            }

            if (!req.user.isActive) {
                return res.status(401).json({ error: 'Account is deactivated' });
            }

            next();
        } catch (error) {
            return res.status(401).json({ error: 'Not authorized, token failed' });
        }
    } else {
        return res.status(401).json({ error: 'Not authorized, no token' });
    }
};

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
};

// ============================================
// IFSC DATABASE (for bank lookup)
// ============================================
const ifscDatabase = {
    'HDFC0001234': {
        bank: 'HDFC Bank',
        branch: 'Andheri East',
        address: 'Plot No. 82, CTS No. 390, Andheri East, Mumbai - 400069',
        city: 'Mumbai',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        contact: '022-12345678',
        rtgs: true,
        neft: true,
        imps: true
    },
    'ICIC0005678': {
        bank: 'ICICI Bank',
        branch: 'Connaught Place',
        address: 'G-52, Connaught Place, New Delhi - 110001',
        city: 'New Delhi',
        district: 'New Delhi',
        state: 'Delhi',
        contact: '011-23456789',
        rtgs: true,
        neft: true,
        imps: true
    },
    'SBIN0001234': {
        bank: 'State Bank of India',
        branch: 'M.G. Road',
        address: 'M.G. Road, Bangalore - 560001',
        city: 'Bangalore',
        district: 'Bangalore Urban',
        state: 'Karnataka',
        contact: '080-12345678',
        rtgs: true,
        neft: true,
        imps: true
    },
    'AXIS0009876': {
        bank: 'Axis Bank',
        branch: 'Park Street',
        address: 'Park Street, Kolkata - 700016',
        city: 'Kolkata',
        district: 'Kolkata',
        state: 'West Bengal',
        contact: '033-12345678',
        rtgs: true,
        neft: true,
        imps: true
    }
};

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ============================================
// AUTH ROUTES
// ============================================

// Register
app.post('/api/auth/register', [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('country').trim().notEmpty().withMessage('Country is required'),
    body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, username, password, phone, country, dateOfBirth } = req.body;

        const existingUser = await User.findOne({
            $or: [{ email }, { username }, { phone }]
        });

        if (existingUser) {
            if (existingUser.email === email) return res.status(400).json({ error: 'Email already registered' });
            if (existingUser.username === username) return res.status(400).json({ error: 'Username already taken' });
            if (existingUser.phone === phone) return res.status(400).json({ error: 'Phone number already registered' });
        }

        const user = await User.create({
            name, email, username, password, phone, country, dateOfBirth
        });

        const token = generateToken(user._id);
        user.lastLogin = new Date();
        await user.save();

        res.status(201).json({
            token,
            user: {
                id: user._id, name: user.name, email: user.email, username: user.username,
                phone: user.phone, country: user.country, dateOfBirth: user.dateOfBirth,
                currency: user.currency, createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
app.post('/api/auth/login', [
    body('identifier').trim().notEmpty().withMessage('Email/Username/Phone is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { identifier, password } = req.body;

        const user = await User.findOne({
            $or: [
                { email: identifier.toLowerCase() },
                { username: identifier },
                { phone: identifier }
            ]
        }).select('+password');

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.isActive) {
            return res.status(401).json({ error: 'Account is deactivated' });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user._id);

        res.json({
            token,
            user: {
                id: user._id, name: user.name, email: user.email, username: user.username,
                phone: user.phone, country: user.country, dateOfBirth: user.dateOfBirth,
                currency: user.currency, createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Get profile
app.get('/api/auth/profile', protect, async (req, res) => {
    try {
        res.json(req.user);
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update profile
app.put('/api/auth/profile', protect, [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim().notEmpty(),
    body('currency').optional().isIn(['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'AED'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const updates = req.body;
        delete updates.password;
        delete updates._id;
        delete updates.username;

        if (updates.email && updates.email !== req.user.email) {
            const existingUser = await User.findOne({ email: updates.email });
            if (existingUser) return res.status(400).json({ error: 'Email already in use' });
        }

        if (updates.phone && updates.phone !== req.user.phone) {
            const existingUser = await User.findOne({ phone: updates.phone });
            if (existingUser) return res.status(400).json({ error: 'Phone number already in use' });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        );

        res.json(user);
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout
app.post('/api/auth/logout', protect, async (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// ============================================
// DATA ROUTES
// ============================================

// Get all user data
app.get('/api/data', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        const [transactions, budgets, goals, bankAccounts] = await Promise.all([
            Transaction.find({ userId }).sort({ date: -1 }),
            Budget.find({ userId }),
            Goal.find({ userId }),
            BankAccount.find({ userId })
        ]);

        res.json({
            db: { transactions, budgets, goals, bankAccounts },
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Data fetch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Save all user data
app.post('/api/data', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const { db } = req.body;

        if (!db) {
            return res.status(400).json({ error: 'No data provided' });
        }

        const operations = [];

        if (db.transactions && Array.isArray(db.transactions)) {
            for (const txn of db.transactions) {
                if (txn._id) {
                    operations.push(
                        Transaction.findOneAndUpdate(
                            { _id: txn._id, userId },
                            { ...txn, userId },
                            { upsert: true, new: true }
                        )
                    );
                } else {
                    operations.push(
                        Transaction.create({ ...txn, userId })
                    );
                }
            }
        }

        if (db.budgets && Array.isArray(db.budgets)) {
            for (const budget of db.budgets) {
                if (budget._id) {
                    operations.push(
                        Budget.findOneAndUpdate(
                            { _id: budget._id, userId },
                            { ...budget, userId },
                            { upsert: true, new: true }
                        )
                    );
                } else {
                    operations.push(
                        Budget.create({ ...budget, userId })
                    );
                }
            }
        }

        if (db.goals && Array.isArray(db.goals)) {
            for (const goal of db.goals) {
                if (goal._id) {
                    operations.push(
                        Goal.findOneAndUpdate(
                            { _id: goal._id, userId },
                            { ...goal, userId },
                            { upsert: true, new: true }
                        )
                    );
                } else {
                    operations.push(
                        Goal.create({ ...goal, userId })
                    );
                }
            }
        }

        if (db.bankAccounts && Array.isArray(db.bankAccounts)) {
            for (const account of db.bankAccounts) {
                if (account._id) {
                    operations.push(
                        BankAccount.findOneAndUpdate(
                            { _id: account._id, userId },
                            { ...account, userId },
                            { upsert: true, new: true }
                        )
                    );
                } else {
                    operations.push(
                        BankAccount.create({ ...account, userId })
                    );
                }
            }
        }

        await Promise.all(operations);

        res.json({ success: true, message: 'Data saved successfully', updatedAt: new Date().toISOString() });
    } catch (error) {
        console.error('Data save error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Clear all user data
app.delete('/api/data', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        await Promise.all([
            Transaction.deleteMany({ userId }),
            Budget.deleteMany({ userId }),
            Goal.deleteMany({ userId }),
            BankAccount.deleteMany({ userId })
        ]);

        res.json({ success: true, message: 'All data cleared' });
    } catch (error) {
        console.error('Data clear error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user statistics
app.get('/api/data/stats', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        const [transactions, budgets, goals] = await Promise.all([
            Transaction.find({ userId }),
            Budget.find({ userId }),
            Goal.find({ userId })
        ]);

        const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

        const monthlyIncome = transactions.filter(t => t.type === 'income' && new Date(t.date) >= startOfMonth).reduce((sum, t) => sum + t.amount, 0);
        const monthlyExpense = transactions.filter(t => t.type === 'expense' && new Date(t.date) >= startOfMonth).reduce((sum, t) => sum + t.amount, 0);

        const yearlyIncome = transactions.filter(t => t.type === 'income' && new Date(t.date) >= startOfYear).reduce((sum, t) => sum + t.amount, 0);
        const yearlyExpense = transactions.filter(t => t.type === 'expense' && new Date(t.date) >= startOfYear).reduce((sum, t) => sum + t.amount, 0);

        const categorySpending = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
        });

        res.json({
            totalIncome, totalExpense, totalSavings: totalIncome - totalExpense,
            monthlyIncome, monthlyExpense, monthlySavings: monthlyIncome - monthlyExpense,
            yearlyIncome, yearlyExpense, yearlySavings: yearlyIncome - yearlyExpense,
            categorySpending,
            transactionCount: transactions.length,
            budgetCount: budgets.length,
            goalCount: goals.length
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// BANK ROUTES
// ============================================

// IFSC lookup
app.post('/api/banks/ifsc-lookup', protect, async (req, res) => {
    try {
        const { ifscCode } = req.body;

        if (!ifscCode) {
            return res.status(400).json({ error: 'IFSC code is required' });
        }

        const normalizedIfsc = ifscCode.toUpperCase();

        if (ifscDatabase[normalizedIfsc]) {
            return res.json({ success: true, bank: ifscDatabase[normalizedIfsc] });
        }

        const bankCode = normalizedIfsc.substring(0, 4);
        const banks = {
            'HDFC': 'HDFC Bank', 'ICIC': 'ICICI Bank', 'SBIN': 'State Bank of India',
            'AXIS': 'Axis Bank', 'INDB': 'IndusInd Bank', 'KOTAK': 'Kotak Mahindra Bank',
            'YESB': 'YES Bank', 'FDRL': 'Federal Bank', 'PUNB': 'Punjab National Bank',
            'CNRB': 'Canara Bank', 'UBIN': 'Union Bank of India', 'BARB': 'Bank of Baroda',
            'BOI': 'Bank of India', 'CBIN': 'Central Bank of India', 'IOBA': 'Indian Overseas Bank',
            'UTIB': 'Axis Bank', 'MAHB': 'Bank of Maharashtra', 'CORP': 'Corporation Bank'
        };

        if (banks[bankCode]) {
            return res.json({
                success: true,
                bank: {
                    bank: banks[bankCode],
                    branch: 'Branch information not available',
                    address: 'Please contact bank for exact address',
                    verified: false
                }
            });
        }

        res.status(404).json({ success: false, error: 'IFSC code not found in database' });
    } catch (error) {
        console.error('IFSC lookup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get branch details
app.get('/api/banks/branches/:ifscCode', protect, async (req, res) => {
    try {
        const { ifscCode } = req.params;
        const normalizedIfsc = ifscCode.toUpperCase();

        if (ifscDatabase[normalizedIfsc]) {
            res.json(ifscDatabase[normalizedIfsc]);
        } else {
            res.status(404).json({ error: 'Branch not found' });
        }
    } catch (error) {
        console.error('Branch lookup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Search banks
app.get('/api/banks/search', protect, async (req, res) => {
    try {
        const { q, city } = req.query;

        if (!q && !city) {
            return res.status(400).json({ error: 'Search query required' });
        }

        const results = Object.entries(ifscDatabase)
            .filter(([code, details]) => {
                const matchesQuery = !q || 
                    details.bank.toLowerCase().includes(q.toLowerCase()) ||
                    details.branch.toLowerCase().includes(q.toLowerCase());
                const matchesCity = !city || 
                    details.city.toLowerCase().includes(city.toLowerCase());
                return matchesQuery && matchesCity;
            })
            .map(([code, details]) => ({ ifsc: code, ...details }));

        res.json({ success: true, count: results.length, results });
    } catch (error) {
        console.error('Bank search error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// CRUD OPERATIONS FOR SPECIFIC ENTITIES
// ============================================

// Transactions CRUD
app.post('/api/transactions', protect, async (req, res) => {
    try {
        const transaction = await Transaction.create({ ...req.body, userId: req.user._id });
        res.status(201).json(transaction);
    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/transactions/:id', protect, async (req, res) => {
    try {
        const transaction = await Transaction.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        res.json(transaction);
    } catch (error) {
        console.error('Update transaction error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/transactions/:id', protect, async (req, res) => {
    try {
        const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        res.json({ success: true, message: 'Transaction deleted' });
    } catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Budgets CRUD
app.post('/api/budgets', protect, async (req, res) => {
    try {
        const budget = await Budget.create({ ...req.body, userId: req.user._id });
        res.status(201).json(budget);
    } catch (error) {
        console.error('Create budget error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/budgets/:id', protect, async (req, res) => {
    try {
        const budget = await Budget.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!budget) return res.status(404).json({ error: 'Budget not found' });
        res.json(budget);
    } catch (error) {
        console.error('Update budget error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/budgets/:id', protect, async (req, res) => {
    try {
        const budget = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });
        res.json({ success: true, message: 'Budget deleted' });
    } catch (error) {
        console.error('Delete budget error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Goals CRUD
app.post('/api/goals', protect, async (req, res) => {
    try {
        const goal = await Goal.create({ ...req.body, userId: req.user._id });
        res.status(201).json(goal);
    } catch (error) {
        console.error('Create goal error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/goals/:id', protect, async (req, res) => {
    try {
        const goal = await Goal.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!goal) return res.status(404).json({ error: 'Goal not found' });
        res.json(goal);
    } catch (error) {
        console.error('Update goal error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/goals/:id', protect, async (req, res) => {
    try {
        const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!goal) return res.status(404).json({ error: 'Goal not found' });
        res.json({ success: true, message: 'Goal deleted' });
    } catch (error) {
        console.error('Delete goal error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Bank Accounts CRUD
app.post('/api/bank-accounts', protect, async (req, res) => {
    try {
        const bankAccount = await BankAccount.create({ ...req.body, userId: req.user._id });
        res.status(201).json(bankAccount);
    } catch (error) {
        console.error('Create bank account error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/bank-accounts/:id', protect, async (req, res) => {
    try {
        const bankAccount = await BankAccount.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!bankAccount) return res.status(404).json({ error: 'Bank account not found' });
        res.json(bankAccount);
    } catch (error) {
        console.error('Update bank account error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/bank-accounts/:id', protect, async (req, res) => {
    try {
        const bankAccount = await BankAccount.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!bankAccount) return res.status(404).json({ error: 'Bank account not found' });
        res.json({ success: true, message: 'Bank account deleted' });
    } catch (error) {
        console.error('Delete bank account error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// EMAIL ROUTES
// ============================================

// Send OTP via Email
app.post('/api/otp/send-email', async (req, res) => {
    try {
        const { email, name, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP required' });
        }

        const nodemailer = require('nodemailer');

        // Configure email transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASSWORD
            }
        });

        // Email template
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                    h1 { color: #2c3e50; text-align: center; }
                    .otp-box { background-color: #3498db; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
                    .otp-box .code { font-size: 36px; font-weight: bold; letter-spacing: 5px; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; border-radius: 4px; }
                    .footer { text-align: center; color: #7f8c8d; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Finance Tracker - Password Reset</h1>
                    <p>Hello ${name || 'User'},</p>
                    <p>You requested to reset your password. Use the OTP below to proceed:</p>
                    
                    <div class="otp-box">
                        <div>Your OTP Code</div>
                        <div class="code">${otp}</div>
                        <div style="font-size: 14px; margin-top: 10px;">Valid for 5 minutes</div>
                    </div>
                    
                    <div class="warning">
                        <strong>⚠️ Security Warning:</strong> Never share this OTP with anyone. Finance Tracker staff will never ask for your OTP.
                    </div>
                    
                    <p>If you didn't request this, please ignore this email. Your account remains secure.</p>
                    
                    <div class="footer">
                        <p>© 2026 Finance Tracker. All rights reserved.</p>
                        <p>This is an automated message, please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Finance Tracker - Password Reset OTP',
            html: htmlContent
        };

        // Send email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Email send error:', error);
                return res.status(500).json({ error: 'Failed to send OTP email' });
            }
            res.json({ success: true, message: 'OTP sent successfully' });
        });

    } catch (error) {
        console.error('OTP email route error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Send Welcome Email
app.post('/api/email/send-welcome', async (req, res) => {
    try {
        const { email, name, username, phone, country, createdAt } = req.body;

        if (!email || !name) {
            return res.status(400).json({ error: 'Email and name required' });
        }

        const nodemailer = require('nodemailer');

        // Configure email transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASSWORD
            }
        });

        // Email template
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                    h1 { color: #2c3e50; text-align: center; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
                    .welcome-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
                    .info-box { background-color: #ecf0f1; padding: 15px; border-radius: 8px; margin: 15px 0; }
                    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #bdc3c7; }
                    .info-row:last-child { border-bottom: none; }
                    .label { font-weight: bold; color: #2c3e50; }
                    .value { color: #34495e; }
                    .features { margin: 20px 0; }
                    .feature-item { padding: 10px; margin: 5px 0; background-color: #f9f9f9; border-left: 4px solid #3498db; }
                    .cta-button { display: inline-block; background-color: #3498db; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
                    .footer { text-align: center; color: #7f8c8d; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🎉 Welcome to Finance Tracker!</h1>
                    
                    <div class="welcome-box">
                        <h2 style="margin-top: 0;">Account Created Successfully</h2>
                        <p>Hello ${name}! Your account is ready to use.</p>
                    </div>

                    <p>Thank you for joining Finance Tracker. Your account has been created with the following details:</p>

                    <div class="info-box">
                        <div class="info-row">
                            <span class="label">Name:</span>
                            <span class="value">${name}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Email:</span>
                            <span class="value">${email}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Username:</span>
                            <span class="value">${username}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Phone:</span>
                            <span class="value">${phone}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Country:</span>
                            <span class="value">${country}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Account Created:</span>
                            <span class="value">${createdAt}</span>
                        </div>
                    </div>

                    <h3>🚀 Get Started with Finance Tracker</h3>
                    <div class="features">
                        <div class="feature-item">📊 Track all your transactions in one place</div>
                        <div class="feature-item">💰 Set and monitor budgets for different categories</div>
                        <div class="feature-item">🎯 Create financial goals and track progress</div>
                        <div class="feature-item">🏦 Manage multiple bank accounts and UPI</div>
                        <div class="feature-item">📱 Generate detailed financial reports</div>
                    </div>

                    <p>Your login credentials are:</p>
                    <p><strong>Username:</strong> ${username}</p>
                    <p><strong>Email:</strong> ${email}</p>

                    <p><strong>⚠️ Security Tip:</strong> Store your username and password securely. You'll need them to log in to your account.</p>

                    <div style="text-align: center;">
                        <a href="${process.env.APP_URL || 'http://localhost:5500'}" class="cta-button">Launch Finance Tracker</a>
                    </div>

                    <p>If you have any questions or need help, please don't hesitate to contact our support team.</p>

                    <div class="footer">
                        <p>© 2026 Finance Tracker. All rights reserved.</p>
                        <p>This is an automated message, please do not reply to this email.</p>
                        <p><a href="#" style="color: #3498db; text-decoration: none;">Visit our website</a> | <a href="#" style="color: #3498db; text-decoration: none;">Contact Support</a></p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: `Welcome to Finance Tracker, ${name}!`,
            html: htmlContent
        };

        // Send email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Welcome email send error:', error);
                return res.status(500).json({ error: 'Failed to send welcome email' });
            }
            res.json({ success: true, message: 'Welcome email sent successfully' });
        });

    } catch (error) {
        console.error('Welcome email route error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// ERROR HANDLING & 404
// ============================================
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Finance Tracker Backend`);
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🔗 API available at http://localhost:${PORT}/api`);
    console.log(`💾 Database: ${MONGODB_URI}`);
    console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}\n`);
});