// scripts/check-env.js
const required = [
  'CLERK_PUBLISHABLE_KEY',
  'CONVEX_URL',
  'VITE_CONVEX_URL',
];

const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ Missing required env vars:', missing.join(', '));
  console.error('Please set them in your .env file.');
  process.exit(1);
} else {
  console.log('✅ All env vars are set correctly!');
  process.exit(0);
}
