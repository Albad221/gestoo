#!/usr/bin/env node
/**
 * Truecaller Setup Script v3
 * Uses the correct API format with client secret
 */

import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

function generateRandomString(length) {
  let result = '';
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function requestOtp(phoneNumber, countryCode, dialingCode) {
  const data = {
    countryCode: countryCode,
    dialingCode: parseInt(dialingCode),
    installationDetails: {
      app: {
        buildVersion: 5,
        majorVersion: 11,
        minorVersion: 7,
        store: 'GOOGLE_PLAY',
      },
      device: {
        deviceId: generateRandomString(16),
        language: 'en',
        manufacturer: 'Samsung',
        model: 'SM-G973F',
        osName: 'Android',
        osVersion: '10',
        mobileServices: ['GMS'],
      },
      language: 'en',
    },
    phoneNumber: phoneNumber.replace(/^\+\d+/, ''), // Remove country code prefix
    region: 'region-2',
    sequenceNo: 2,
  };

  const response = await fetch('https://account-asia-south1.truecaller.com/v2/sendOnboardingOtp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'accept-encoding': 'gzip',
      'user-agent': 'Truecaller/11.75.5 (Android;10)',
      'clientsecret': 'lvc22mp3l1sfv6ujg83rd17btt',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

async function verifyOtp(phoneNumber, countryCode, dialingCode, requestId, otp) {
  const data = {
    countryCode: countryCode,
    dialingCode: parseInt(dialingCode),
    phoneNumber: phoneNumber.replace(/^\+\d+/, ''),
    requestId: requestId,
    token: otp,
  };

  const response = await fetch('https://account-asia-south1.truecaller.com/v1/verifyOnboardingOtp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'accept-encoding': 'gzip',
      'user-agent': 'Truecaller/11.75.5 (Android;10)',
      'clientsecret': 'lvc22mp3l1sfv6ujg83rd17btt',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

async function main() {
  console.log('='.repeat(60));
  console.log('Truecaller Setup v3 for Teranga Safe');
  console.log('='.repeat(60));
  console.log('\nThis will send an OTP via SMS to your phone.\n');

  const phoneNumber = await question('Enter phone number (e.g., +221772292865): ');

  // Parse country code
  const countryMap = {
    '+221': { code: 'SN', dial: '221' },
    '+33': { code: 'FR', dial: '33' },
    '+1': { code: 'US', dial: '1' },
    '+91': { code: 'IN', dial: '91' },
    '+234': { code: 'NG', dial: '234' },
    '+44': { code: 'GB', dial: '44' },
  };

  let countryCode = 'SN';
  let dialingCode = '221';

  for (const [prefix, info] of Object.entries(countryMap)) {
    if (phoneNumber.startsWith(prefix)) {
      countryCode = info.code;
      dialingCode = info.dial;
      break;
    }
  }

  // Extract just the phone number without country code
  const significantNumber = phoneNumber.replace(/^\+\d{1,3}/, '');

  console.log(`\nCountry: ${countryCode}, Dialing Code: +${dialingCode}`);
  console.log(`Phone: ${significantNumber}`);
  console.log('\nSending OTP...\n');

  try {
    const otpResponse = await requestOtp(phoneNumber, countryCode, dialingCode);
    console.log('Response:', JSON.stringify(otpResponse, null, 2));

    if (otpResponse.status === 1 || otpResponse.status === 9 || otpResponse.requestId) {
      console.log('\n✓ OTP sent! Check your SMS.\n');

      const otp = await question('Enter the 6-digit OTP: ');

      console.log('\nVerifying...\n');
      const verifyResponse = await verifyOtp(
        phoneNumber,
        countryCode,
        dialingCode,
        otpResponse.requestId,
        otp.trim()
      );

      console.log('Verify Response:', JSON.stringify(verifyResponse, null, 2));

      if (verifyResponse.installationId) {
        console.log('\n' + '='.repeat(60));
        console.log('✓ SUCCESS!');
        console.log('='.repeat(60));
        console.log('\nYour Installation ID:');
        console.log(verifyResponse.installationId);
        console.log('\nAdd this line to your .env.local file:');
        console.log(`\nTRUECALLER_INSTALLATION_ID=${verifyResponse.installationId}\n`);
        console.log('='.repeat(60));
      } else if (verifyResponse.suspended) {
        console.log('\n✗ Account suspended. Try with a different number.');
      } else if (verifyResponse.status === 6) {
        console.log('\n✗ Invalid OTP. Please try again.');
      } else {
        console.log('\n✗ Verification failed.');
      }
    } else if (otpResponse.status === 6 || otpResponse.status === 5) {
      console.log('\n✗ Too many attempts. Please wait and try again later.');
    } else {
      console.log('\n✗ Failed to send OTP.');
      console.log('This could mean:');
      console.log('  - Your number is not registered with Truecaller app');
      console.log('  - Rate limited - wait a few minutes');
      console.log('  - Regional restriction');
    }
  } catch (error) {
    console.error('\nError:', error.message);
  }

  rl.close();
}

main().catch(console.error);
