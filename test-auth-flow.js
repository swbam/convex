// Test auth flow with console logging
const testEmail = `test${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';

console.log('🧪 Starting auth flow test...');
console.log('Test credentials:', { email: testEmail, password: testPassword });

// This script should be run in browser console on http://localhost:5173/signup
async function testSignUp() {
  console.log('📧 Filling out sign-up form...');
  
  // Fill email
  const emailInput = document.querySelector('input[type="email"]');
  const passwordInput = document.querySelector('input[type="password"]');
  const submitButton = document.querySelector('button[type="submit"]');
  
  if (!emailInput || !passwordInput || !submitButton) {
    console.error('❌ Form elements not found!');
    return;
  }
  
  emailInput.value = testEmail;
  passwordInput.value = testPassword;
  
  console.log('✅ Form filled, submitting...');
  submitButton.click();
  
  console.log('⏳ Waiting for auth flow to complete...');
  console.log('👀 Watch for logs starting with 📧, 🔍, 🔧, ✅, ❌');
}

// Run the test
testSignUp();
