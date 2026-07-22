const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.log('CRITICAL REACT CRASH ERROR:', err.message);
    console.log(err.stack);
  });
  
  await page.goto('http://localhost:5175/');
  await page.waitForTimeout(2000);
  
  // Click Table 1
  await page.evaluate(() => {
     const table = [...document.querySelectorAll('div')].find(d => d.innerText && d.innerText.includes('Table 1') && d.innerText.includes('Vacant'));
     if (table) table.click();
  });
  await page.waitForTimeout(1000);
  
  // Click add Soda
  await page.evaluate(() => {
     const soda = [...document.querySelectorAll('div')].find(d => d.innerText && d.innerText.includes('Soda'));
     if (soda) soda.click();
  });
  await page.waitForTimeout(1000);
  
  // Click KOT
  await page.evaluate(() => {
     const kot = [...document.querySelectorAll('button')].find(b => b.innerText && b.innerText.includes('KOT'));
     if (kot) kot.click();
  });
  await page.waitForTimeout(2000);
  console.log('Test completed.');
  await browser.close();
})();
