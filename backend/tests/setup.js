// Runs before each test file is evaluated. Sets the minimum env the app
// validates at import time (envConfig.js process.exit()s if these are missing),
// using ||= so a real .env / CI value is never overridden.
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY ||= 'test-gemini-key';
process.env.JWT_SECRET ||= 'test-jwt-secret-0123456789';

// Force the mock payment paths: a developer's .env may carry real Razorpay /
// IAP keys, and dotenv never overrides pre-set vars — so blanking them HERE
// (before envConfig loads .env) keeps tests deterministic on any machine.
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
process.env.APPLE_IAP_SECRET = '';
process.env.GOOGLE_IAP_SERVICE_ACCOUNT_JSON = '';
