#!/usr/bin/env node
/**
 * Truecaller Setup Script
 *
 * This script helps you login to Truecaller and get your installation ID
 * which is needed for phone number lookups.
 *
 * Usage:
 *   node scripts/truecaller-setup.mjs
 *
 * After running this, add the installation ID to your .env.local:
 *   TRUECALLER_INSTALLATION_ID=your_installation_id_here
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
  console.log('Truecaller Setup for Teranga Safe');
  console.log('='.repeat(60));
  console.log('\nThis will send an OTP to your phone number.');
  console.log('You need a phone number that has Truecaller installed.\n');

  const phoneNumber = await question('Enter your phone number (with country code, e.g., +221771234567): ');

  if (!phoneNumber.startsWith('+')) {
    console.log('\nError: Phone number must start with + and country code');
    rl.close();
    process.exit(1);
  }

  // Extract country code
  const countryCodeMap = {
    '+221': 'SN', // Senegal
    '+33': 'FR',  // France
    '+1': 'US',   // USA
    '+91': 'IN',  // India
    '+234': 'NG', // Nigeria
    '+44': 'GB',  // UK
  };

  let countryCode = 'SN';
  for (const [prefix, code] of Object.entries(countryCodeMap)) {
    if (phoneNumber.startsWith(prefix)) {
      countryCode = code;
      break;
    }
  }

  console.log(`\nDetected country: ${countryCode}`);
  console.log('Sending OTP...\n');

  try {
    // Request OTP
    const loginResponse = await truecallerjs.login(phoneNumber, countryCode);

    if (loginResponse.status === 1 || loginResponse.message?.includes('Sent')) {
      console.log('OTP sent successfully!');

      const otp = await question('\nEnter the OTP you received: ');

      // Verify OTP
      const verifyResponse = await truecallerjs.verifyOtp(
        phoneNumber,
        loginResponse,
        otp
      );

      if (verifyResponse.status === 2 && verifyResponse.installationId) {
        console.log('\n' + '='.repeat(60));
        console.log('SUCCESS! Your installation ID:');
        console.log('='.repeat(60));
        console.log(`\n${verifyResponse.installationId}\n`);
        console.log('Add this to your .env.local file:');
        console.log(`TRUECALLER_INSTALLATION_ID=${verifyResponse.installationId}\n`);
        console.log('='.repeat(60));
      } else if (verifyResponse.suspended) {
        console.log('\nError: Account suspended. Try with a different number.');
      } else {
        console.log('\nVerification failed:', verifyResponse.message || 'Unknown error');
        console.log('Full response:', JSON.stringify(verifyResponse, null, 2));
      }
    } else if (loginResponse.status === 9) {
      console.log('\nThis number is already registered. Trying alternate login...');

      const otp = await question('Enter the OTP from Truecaller app: ');

      const verifyResponse = await truecallerjs.verifyOtp(
        phoneNumber,
        loginResponse,
        otp
      );

      if (verifyResponse.installationId) {
        console.log('\n' + '='.repeat(60));
        console.log('SUCCESS! Your installation ID:');
        console.log('='.repeat(60));
        console.log(`\n${verifyResponse.installationId}\n`);
      } else {
        console.log('\nFailed:', JSON.stringify(verifyResponse, null, 2));
      }
    } else {
      console.log('\nLogin failed:', loginResponse.message || 'Unknown error');
      console.log('Status:', loginResponse.status);
      console.log('Full response:', JSON.stringify(loginResponse, null, 2));
    }
  } catch (error) {
    console.error('\nError:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }

  rl.close();
}

main().catch(console.error);
