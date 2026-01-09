#!/usr/bin/env node
/**
 * Truecaller Setup v4 - Using the library directly
 */

import truecallerjs from 'truecallerjs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

async function main() {
  console.log('='.repeat(60));
  console.log('Truecaller Setup v4 for Teranga Safe');
  console.log('='.repeat(60));
  console.log('\nThis will send an OTP via SMS to your phone.');
  console.log('Make sure Truecaller app is installed on your phone.\n');

  const phoneNumber = await question('Enter phone number (e.g., +221772292865): ');

  console.log('\nSending OTP request...\n');

  try {
    // Use the truecallerjs library login function
    const loginResponse = await truecallerjs.login(phoneNumber.trim());

    console.log('Login Response:', JSON.stringify(loginResponse, null, 2));

    if (loginResponse.status === 1 || loginResponse.status === 9 || loginResponse.requestId) {
      console.log('\n✓ OTP sent! Check your SMS.\n');

      const otp = await question('Enter the 6-digit OTP: ');

      console.log('\nVerifying OTP...\n');

      // Use the truecallerjs verify function
      const verifyResponse = await truecallerjs.verifyOtp(
        phoneNumber.trim(),
        loginResponse,
        otp.trim()
      );

      console.log('Verify Response:', JSON.stringify(verifyResponse, null, 2));

      if (verifyResponse.installationId) {
        console.log('\n' + '='.repeat(60));
        console.log('✓ SUCCESS!');
        console.log('='.repeat(60));
        console.log('\nAdd this to your .env.local:');
        console.log(`\nTRUECALLER_INSTALLATION_ID=${verifyResponse.installationId}\n`);
        console.log('='.repeat(60));
      } else if (verifyResponse.suspended) {
        console.log('\n✗ Account suspended.');
      } else if (verifyResponse.status === 6) {
        console.log('\n✗ Invalid OTP.');
      } else {
        console.log('\n✗ Verification failed.');
      }
    } else if (loginResponse.status === 6 || loginResponse.status === 5) {
      console.log('\n✗ Rate limited. Wait a few minutes and try again.');
    } else if (loginResponse.status === 40003) {
      console.log('\n✗ Invalid phone number format.');
      console.log('Make sure to include country code (e.g., +221772292865)');
    } else {
      console.log('\n✗ Failed. Status:', loginResponse.status);
      console.log('\nPossible reasons:');
      console.log('  1. Truecaller app not installed on this number');
      console.log('  2. Number not verified in Truecaller app');
      console.log('  3. Regional restriction');
      console.log('\nSolution: Open Truecaller app on your phone and make sure');
      console.log('your number is verified, then try again.');
    }
  } catch (error) {
    console.error('\nError:', error.message);

    if (error.message.includes('Invalid phone')) {
      console.log('\nMake sure your phone number:');
      console.log('  - Starts with + and country code');
      console.log('  - Example: +221772292865');
    }
  }

  rl.close();
}

main().catch(console.error);
