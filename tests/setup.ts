// Shared test setup. Fast password hashing is enabled by NODE_ENV=test (see src/lib/auth/password.ts).
Object.assign(process.env, { NODE_ENV: "test" });
process.env.APP_SECRET ??= "test-secret-that-is-long-enough-for-hmac-1234567890";
process.env.APP_URL ??= "http://localhost:3000";
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
