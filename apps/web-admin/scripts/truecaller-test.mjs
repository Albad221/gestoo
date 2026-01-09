#!/usr/bin/env node
/**
 * Test Truecaller search with an existing installation ID
 * If you have a friend with Truecaller, they can share their installation ID
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
  console.log('Truecaller Search Test');
  console.log('='.repeat(60));

  // Check if we already have an installation ID
  const existingId = process.env.TRUECALLER_INSTALLATION_ID;

  let installationId = existingId;

  if (!installationId) {
    console.log('\nNo TRUECALLER_INSTALLATION_ID found in environment.');
    console.log('\nOptions:');
    console.log('1. Get an installation ID from someone who has Truecaller');
    console.log('2. Or paste one here to test:\n');

    installationId = await question('Enter installation ID (or press Enter to skip): ');

    if (!installationId.trim()) {
      console.log('\nNo installation ID provided.');
      console.log('\nTo get one, ask someone with Truecaller app to:');
      console.log('1. Install truecallerjs: npm install -g truecallerjs');
      console.log('2. Run: truecallerjs login');
      console.log('3. After OTP verification, run: truecallerjs -i');
      console.log('4. Share the installation ID with you');
      rl.close();
      return;
    }
  }

  console.log('\nUsing installation ID:', installationId.substring(0, 20) + '...');

  const phoneNumber = await question('\nEnter phone number to search (e.g., +221772292865): ');

  // Determine country code
  let countryCode = 'SN';
  if (phoneNumber.startsWith('+33')) countryCode = 'FR';
  else if (phoneNumber.startsWith('+1')) countryCode = 'US';
  else if (phoneNumber.startsWith('+91')) countryCode = 'IN';

  console.log('\nSearching...\n');

  try {
    const searchData = {
      number: phoneNumber.replace(/^\+/, ''),
      countryCode: countryCode,
      installationId: installationId.trim(),
    };

    const response = await truecallerjs.search(searchData);

    console.log('='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));

    const name = response.getName();
    const email = response.getEmailId();
    const altPhone = response.getAlternateNumber();
    const address = response.getAddresses();

    console.log('\nName:', name || 'Not found');
    console.log('Email:', email || 'Not found');
    console.log('Alt Phone:', altPhone || 'Not found');
    console.log('Address:', address || 'Not found');

    // Raw JSON for debugging
    const rawData = response.json();
    if (rawData?.data?.[0]) {
      const contact = rawData.data[0];
      console.log('\nSpam Score:', contact.spamInfo?.spamScore || 'N/A');
      console.log('Spam Type:', contact.spamInfo?.spamType || 'N/A');
      if (contact.image) {
        console.log('Photo URL:', contact.image);
      }
    }

    console.log('\n='.repeat(60));
    console.log('\nFull response saved to truecaller-result.json');

    const fs = await import('fs');
    fs.writeFileSync('truecaller-result.json', JSON.stringify(rawData, null, 2));

  } catch (error) {
    console.error('Search failed:', error.message);

    if (error.message.includes('401') || error.message.includes('invalid')) {
      console.log('\nThe installation ID may be invalid or expired.');
      console.log('Try getting a new one from someone with Truecaller.');
    }
  }

  rl.close();
}

main().catch(console.error);
