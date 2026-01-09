import puppeteer from 'puppeteer';

async function test() {
  console.log('Starting Puppeteer test...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  console.log('Browser launched');

  const page = await browser.newPage();
  console.log('New page created');

  await page.goto('https://example.com', { waitUntil: 'networkidle2' });
  console.log('Navigated to example.com');

  const title = await page.title();
  console.log('Page title:', title);

  await browser.close();
  console.log('Browser closed. Test successful!');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
