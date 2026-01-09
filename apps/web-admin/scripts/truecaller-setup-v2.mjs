#!/usr/bin/env node
/**
 * Truecaller Setup Script v2
 * Uses the raw API method for better compatibility
 */

import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

async function requestOtp(phoneNumber) {
  const response = await fetch('https://account-asia-south1.truecaller.com/v2/sendOnboardingOtp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Truecaller/13.27.8 (Android;13)',
    },
    body: JSON.stringify({
      phoneNumber: phoneNumber,
      region: 'region-2',
      sequenceNo: 2,
    }),
  });
  return response.json();
}

async function verifyOtp(phoneNumber, otp, requestId) {
  const response = await fetch('https://account-asia-south1.truecaller.com/v1/verifyOnboardingOtp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Truecaller/13.27.8 (Android;13)',
    },
    body: JSON.stringify({
      phoneNumber: phoneNumber,
      region: 'region-2',
      otp: otp,
      requestId: requestId,
    }),
  });
  return response.json();
}

async function main() {
  console.log('='.repeat(60));
  console.log('Truecaller Setup v2 for Teranga Safe');
  console.log('='.repeat(60));
  console.log('\nNote: You need to have Truecaller app installed on your phone.');
  console.log('The OTP will be sent via SMS.\n');

  const phoneNumber = await question('Enter phone number (e.g., +221772292865): ');

  console.log('\nRequesting OTP...');

  try {
    const otpResponse = await requestOtp(phoneNumber);
    console.log('OTP Response:', JSON.stringify(otpResponse, null, 2));

    if (otpResponse.status === 1 || otpResponse.status === 9 || otpResponse.requestId) {
      const otp = await question('\nEnter the OTP from SMS: ');

      console.log('\nVerifying...');
      const verifyResponse = await verifyOtp(phoneNumber, otp, otpResponse.requestId);
      console.log('Verify Response:', JSON.stringify(verifyResponse, null, 2));

      if (verifyResponse.installationId) {
        console.log('\n' + '='.repeat(60));
        console.log('SUCCESS!');
        console.log('='.repeat(60));
        console.log('\nAdd this to your .env.local:');
        console.log(`TRUECALLER_INSTALLATION_ID=${verifyResponse.installationId}`);
        console.log('\n' + '='.repeat(60));
      }
    } else {
      console.log('\nFailed to request OTP. Status:', otpResponse.status);

      // Try alternative endpoint
      console.log('\nTrying alternative method...');

      const altResponse = await fetch('https://account-noneu.truecaller.com/v2/sendOnboardingOtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Truecaller/13.27.8 (Android;13)',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          region: 'region-1',
          sequenceNo: 1,
        }),
      });
      const altData = await altResponse.json();
      console.log('Alt Response:', JSON.stringify(altData, null, 2));

      if (altData.requestId) {
        const otp = await question('\nEnter the OTP: ');
        const verifyAlt = await fetch('https://account-noneu.truecaller.com/v1/verifyOnboardingOtp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Truecaller/13.27.8 (Android;13)',
          },
          body: JSON.stringify({
            phoneNumber: phoneNumber,
            region: 'region-1',
            otp: otp,
            requestId: altData.requestId,
          }),
        });
        const verifyAltData = await verifyAlt.json();
        console.log('Verify:', JSON.stringify(verifyAltData, null, 2));

        if (verifyAltData.installationId) {
          console.log('\nSUCCESS! Add to .env.local:');
          console.log(`TRUECALLER_INSTALLATION_ID=${verifyAltData.installationId}`);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  rl.close();
}

main().catch(console.error);
