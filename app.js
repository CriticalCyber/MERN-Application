const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const cookieParser = require('cookie-parser');
const cors = require('cors');
const errorMiddleware = require('./middlewares/error');
// Import security middleware
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const methodOverride = require('method-override');
// Import request tracker middleware
const { requestTracker } = require('./middlewares/error');

const app = express();

// Fix rate limiter warning
app.set("trust proxy", 1);

// config
// Environment variables are loaded in server.js

// Set security headers
app.use(helmet());

// Prevent NoSQL injection
app.use(mongoSanitize());

// Request tracking middleware (early in the middleware chain)
app.use(requestTracker);

// Enhanced CORS configuration for session cookies
app.use(cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'https://your-client-domain.com'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser middleware (required for session)
app.use(cookieParser());

// Method override middleware to allow POST requests to be treated as PUT/PATCH/DELETE
app.use(methodOverride('_method'));

// Import OTP route before session middleware to make it public
const otp = require('./routes/otpRoute');

// Mount OTP routes before session middleware
app.use('/api/v1/otp', otp);

// Session middleware (required for CSRF) - applied after public routes
app.use(session({
  name: 'shubhvaluecart.sid',
  secret: process.env.SESSION_SECRET, // Must exist in .env
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 24 hours
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true in production with HTTPS
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/'
  }
}));

// ❌ DO NOT apply csrf() globally here

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

const user = require('./routes/userRoute');
const admin = require('./routes/adminRoute');
const product = require('./routes/productRoute');
const userOrder = require('./routes/userOrderRoute');  // ✅ User-only order routes
const adminOrder = require('./routes/adminOrderRoute');  // ✅ Admin-only order routes
const payment = require('./routes/paymentRoute');
const bulk = require('./routes/bulkRoutes');
const bulkInventory = require('./routes/bulkInventoryRoute');
const bulkExcel = require('./routes/bulkExcelRoute');
const coupon = require('./routes/couponRoute');
const giftcard = require('./routes/giftCardRoute');
const category = require('./routes/categoryRoute');
const inventory = require('./routes/inventoryRoute');
const delivery = require('./routes/deliveryRoute');
const deliveryOperations = require('./routes/deliveryOperationsRoute');
const notification = require('./routes/notificationRoute');
const notificationTemplate = require('./routes/notificationTemplateRoute');
const settings = require('./routes/settingsRoute');
const promotionsPopup = require('./routes/promotionsPopupRoute');
const publicPromotions = require('./routes/publicPromotionsRoute');
const contactMessage = require('./routes/contactMessageRoute');
// Shiprocket routes have been removed as part of local delivery implementation
const publicTracking = require('./routes/publicTrackingRoute');
const codSettlement = require('./routes/codSettlementRoute');
const taxRate = require('./routes/taxRateRoute');
const excelImport = require('./routes/excelImportRoute');

// ✅ STRICT MIDDLEWARE MOUNTING ORDER FOR CONTEXT ISOLATION

// 1. ADMIN ROUTES (Session-based authentication ONLY)
app.use('/api/v1/admin', admin);
app.use('/api/v1/admin', adminOrder);  // ✅ Admin-only order routes

// 2. USER ROUTES (JWT-based authentication ONLY)
app.use('/api/v1', user);
app.use('/api/v1', product);
app.use('/api/v1', userOrder);  // ✅ User-only order routes
app.use('/api/v1', payment);
app.use('/api/v1', bulk);
app.use('/api/v1', bulkInventory);
app.use('/api/v1', bulkExcel);
app.use('/api/v1', coupon);
app.use('/api/v1', giftcard);
app.use('/api/v1', category);
app.use('/api/v1', inventory);
app.use('/api/v1', delivery);
app.use('/api/v1', deliveryOperations);
app.use('/api/v1', notification);
app.use('/api/v1', notificationTemplate);
app.use('/api/v1', settings);
app.use('/api/v1', promotionsPopup);
app.use('/api/v1', contactMessage);

// 3. PUBLIC ROUTES (No authentication)
app.use('/public', publicPromotions);
app.use('/public', publicTracking);
app.use('/api/v1/cod-settlements', codSettlement);
app.use('/api/v1/tax-rates', taxRate);
app.use('/api/v1/excel-import', excelImport);


// error middleware
app.use(errorMiddleware);

module.exports = app;