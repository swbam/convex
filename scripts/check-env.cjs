// scripts/check-env.js
// Load .env files for local development
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const isProductionLike =
  process.env.NODE_ENV === 'production' ||
  process.env.CHECK_ENV_STRICT === '1' ||
  process.env.CI === 'true';

const requiredPairs = [
  ['VITE_CLERK_PUBLISHABLE_KEY', 'CLERK_PUBLISHABLE_KEY'],
  ['VITE_CONVEX_URL', 'CONVEX_URL'],
];

const backendRequired = [
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'TICKETMASTER_API_KEY',
  'SETLISTFM_API_KEY',
  'SITE_URL',
];

const productionOnly = [
  'RESEND_API_KEY',
  'OWNER_NOTIFICATION_EMAIL',
  'SPOTIFY_TOKEN_ENC_KEY',
];

const missing = [];
for (const [primary, fallback] of requiredPairs) {
  if (!process.env[primary] && !process.env[fallback]) {
    missing.push(`${primary} or ${fallback}`);
  }
}

for (const envVar of backendRequired) {
  if (!process.env[envVar]) {
    missing.push(envVar);
  }
}

if (isProductionLike) {
  for (const envVar of productionOnly) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
}

if (missing.length > 0) {
  console.error('❌ Missing required env vars:', missing.join(', '));
  console.error('Please set them in your .env.local or .env file.');
  process.exit(1);
} else {
  const warnings = [];
  if (!process.env.SENTRY_DSN) {
    warnings.push('SENTRY_DSN is not set');
  }
  if (isProductionLike && !process.env.CLERK_SECRET_KEY) {
    warnings.push('CLERK_SECRET_KEY is not set; Clerk admin role sync will be skipped');
  }
  if (isProductionLike && !process.env.CLERK_WEBHOOK_SECRET) {
    warnings.push('CLERK_WEBHOOK_SECRET is not set; Clerk webhook ingestion will reject requests');
  }
  if (warnings.length > 0) {
    console.warn('⚠️ Env warnings:', warnings.join(', '));
  }
  console.log(`✅ All ${isProductionLike ? 'launch-critical' : 'required'} env vars are set correctly!`);
  process.exit(0);
}
