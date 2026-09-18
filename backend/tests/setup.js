// Runs before each test file is evaluated. Sets the minimum env the app
// validates at import time (envConfig.js process.exit()s if these are missing),
// using ||= so a real .env / CI value is never overridden.
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY ||= 'test-gemini-key';
process.env.JWT_SECRET ||= 'test-jwt-secret-0123456789';
