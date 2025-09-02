#!/usr/bin/env node

/**
 * Deployment Health Check Script
 * Run this to verify your deployment is properly configured
 */

const REQUIRED_ENV_VARS = [
  'VITE_CONVEX_URL',
  'VITE_CLERK_PUBLISHABLE_KEY'
];

const OPTIONAL_ENV_VARS = [
  'CLERK_SECRET_KEY',
  'CLERK_ISSUER_URL',
  'CLERK_JWKS_URL',
  'SITE_URL',
  'TICKETMASTER_API_KEY',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SETLISTFM_API_KEY'
];

console.log('🔍 Checking deployment configuration...\n');

// Check for .env.local file
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const hasEnvFile = fs.existsSync(envPath);

if (!hasEnvFile) {
  console.log('❌ .env.local file not found');
  console.log('   Create one by copying .env.example:\n');
  console.log('   cp .env.example .env.local\n');
} else {
  console.log('✅ .env.local file found\n');
}

// Check environment variables
console.log('Required Environment Variables:');
let allRequiredPresent = true;

REQUIRED_ENV_VARS.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName}: Set`);
  } else {
    console.log(`❌ ${varName}: Missing`);
    allRequiredPresent = false;
  }
});

console.log('\nOptional Environment Variables:');
OPTIONAL_ENV_VARS.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName}: Set`);
  } else {
    console.log(`⚠️  ${varName}: Not set (optional)`);
  }
});

// Check if running locally or on Vercel
const isVercel = process.env.VERCEL === '1';
console.log(`\n📍 Environment: ${isVercel ? 'Vercel' : 'Local'}`);

if (!allRequiredPresent) {
  console.log('\n❌ Deployment check failed!');
  console.log('\n📝 Next steps:');
  console.log('1. Set the missing environment variables');
  if (isVercel) {
    console.log('2. Go to Vercel Dashboard → Settings → Environment Variables');
    console.log('3. Add the missing variables');
    console.log('4. Redeploy your application');
  } else {
    console.log('2. Add them to your .env.local file');
    console.log('3. Restart your development server');
  }
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set!');
  console.log('Your deployment should work correctly.');
  
  // Check Convex URL format
  const convexUrl = process.env.VITE_CONVEX_URL;
  if (convexUrl && !/https:\/\/.*\.convex\.cloud/.test(convexUrl)) {
    console.log('\n⚠️  Warning: VITE_CONVEX_URL doesn\'t look like a valid Convex URL');
    console.log('   Expected format: https://your-deployment.convex.cloud');
  }

  // Suggest expected URLs for this repo
  const expectedDev = 'https://necessary-mosquito-453.convex.cloud';
  const expectedProd = 'https://exuberant-weasel-22.convex.cloud';
  console.log(`\nℹ️  Expected dev Convex: ${expectedDev}`);
  console.log(`ℹ️  Expected prod Convex: ${expectedProd}`);
}