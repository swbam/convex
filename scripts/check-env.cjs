// scripts/check-env.js
// Load .env files for local development
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

// Check for required vars - support both VITE_ prefixed and non-prefixed versions
const requiredPairs = [
  ['VITE_CLERK_PUBLISHABLE_KEY', 'CLERK_PUBLISHABLE_KEY'],
  ['VITE_CONVEX_URL', 'CONVEX_URL'],
];

const missing = [];
for (const [primary, fallback] of requiredPairs) {
  if (!process.env[primary] && !process.env[fallback]) {
    missing.push(`${primary} or ${fallback}`);
  }
}

if (missing.length > 0) {
  console.error('❌ Missing required env vars:', missing.join(', '));
  console.error('Please set them in your .env.local or .env file.');
  process.exit(1);
} else {
  console.log('✅ All env vars are set correctly!');
  process.exit(0);
}
