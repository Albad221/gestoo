#!/usr/bin/env node
/**
 * Truecaller Setup v5 - Try all endpoints and formats
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

const ENDPOINTS = [
  'https://account-asia-south1.truecaller.com/v2/sendOnboardingOtp',
  'https://account-noneu.truecaller.com/v2/sendOnboardingOtp',
  'https://account-eu.truecaller.com/v2/sendOnboardingOtp',
  'https://account.truecaller.com/v2/sendOnboardingOtp',
];

const CLIENT_SECRETS = [
  'lvc22mp3l1sfv6ujg83rd17btt',  // From library
];

async function tryLogin(endpoint, phoneNumber, countryCode, dialingCode, clientSecret) {
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
    phoneNumber: phoneNumber,
    region: 'region-2',
    sequenceNo: 2,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'accept-encoding': 'gzip',
        'user-agent': 'Truecaller/11.75.5 (Android;10)',
        'clientsecret': clientSecret,
      },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (e) {
    return { error: e.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Truecaller Setup v5 - Multi-endpoint Test');
  console.log('='.repeat(60));

  const fullPhone = await question('\nEnter full phone number (e.g., +221772292865): ');

  // Parse phone
  const match = fullPhone.match(/^\+(\d{1,3})(\d+)$/);
  if (!match) {
    console.log('Invalid format. Use +XXXYYYYYYYY');
    rl.close();
    return;
  }

  const dialingCode = match[1];
  const phoneNumber = match[2];

  // Map dialing code to country code
  const dialToCountry = {
    '221': 'SN', '33': 'FR', '1': 'US', '91': 'IN',
    '234': 'NG', '44': 'GB', '212': 'MA', '216': 'TN',
  };
  const countryCode = dialToCountry[dialingCode] || 'SN';

  console.log(`\nParsed: Country=${countryCode}, Dial=+${dialingCode}, Number=${phoneNumber}`);
  console.log('\nTrying all endpoints...\n');

  let successEndpoint = null;
  let successResponse = null;

  for (const endpoint of ENDPOINTS) {
    for (const secret of CLIENT_SECRETS) {
      const shortEndpoint = endpoint.replace('https://account', '').replace('.truecaller.com/v2/sendOnboardingOtp', '');
      process.stdout.write(`Trying ${shortEndpoint}... `);

      const result = await tryLogin(endpoint, phoneNumber, countryCode, dialingCode, secret);

      if (result.status === 1 || result.status === 9 || result.requestId) {
        console.log('✓ SUCCESS!');
        successEndpoint = endpoint;
        successResponse = result;
        break;
      } else if (result.status === 6 || result.status === 5) {
        console.log('Rate limited');
      } else {
        console.log(`✗ ${result.status || result.error}`);
      }
    }
    if (successEndpoint) break;
  }

  if (!successEndpoint) {
    console.log('\n' + '='.repeat(60));
    console.log('All endpoints failed.');
    console.log('='.repeat(60));
    console.log('\nThis might be because:');
    console.log('1. Truecaller has blocked automated signups from your region');
    console.log('2. Your number format is different than expected');
    console.log('\nALTERNATIVE: Extract installation ID from your phone');
    console.log('\nOn Android:');
    console.log('  1. Install "App Inspector" from Play Store');
    console.log('  2. Open it and find Truecaller');
    console.log('  3. Look for SharedPreferences → "account" or "installation"');
    console.log('  4. Find the "installationId" value');
    console.log('\nOr use ADB:');
    console.log('  adb shell cat /data/data/com.truecaller/shared_prefs/*.xml | grep installation');

    rl.close();
    return;
  }

  console.log('\n✓ OTP request successful!');
  console.log('Response:', JSON.stringify(successResponse, null, 2));

  const otp = await question('\nEnter the OTP from SMS: ');

  // Verify OTP
  const verifyEndpoint = successEndpoint.replace('sendOnboardingOtp', 'verifyOnboardingOtp').replace('/v2/', '/v1/');

  const verifyData = {
    countryCode: countryCode,
    dialingCode: parseInt(dialingCode),
    phoneNumber: phoneNumber,
    requestId: successResponse.requestId,
    token: otp.trim(),
  };

  const verifyResponse = await fetch(verifyEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'accept-encoding': 'gzip',
      'user-agent': 'Truecaller/11.75.5 (Android;10)',
      'clientsecret': 'lvc22mp3l1sfv6ujg83rd17btt',
    },
    body: JSON.stringify(verifyData),
  });

  const verifyResult = await verifyResponse.json();
  console.log('\nVerify result:', JSON.stringify(verifyResult, null, 2));

  if (verifyResult.installationId) {
    console.log('\n' + '='.repeat(60));
    console.log('SUCCESS!');
    console.log('='.repeat(60));
    console.log('\nAdd to .env.local:');
    console.log(`TRUECALLER_INSTALLATION_ID=${verifyResult.installationId}`);
  }

  rl.close();
}

main().catch(console.error);
