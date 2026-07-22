const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.log('REACT INVARIANT/FATAL ERROR:', err.message, err.stack);
  });
  
  await page.goto('http://localhost:5178/');
  await page.waitForTimeout(2000);
  
  // Click Table 1
  let clickedTable = await page.evaluate(() => {
     const table = [...document.querySelectorAll('div')].find(d => d.innerText && d.innerText.includes('Table 1') && d.innerText.includes('Vacant'));
     if (table) { table.click(); return true; }
     return false;
  });
  console.log('Clicked Table:', clickedTable);
  await page.waitForTimeout(1000);
  
  // Click add Soda
  let clickedSoda = await page.evaluate(() => {
     const soda = [...document.querySelectorAll('div')].find(d => d.innerText && d.innerText.includes('Soda'));
     if (soda) { soda.click(); return true; }
     return false;
  });
  console.log('Clicked Soda:', clickedSoda);
  await page.waitForTimeout(500);
  
  // Click KOT
  let clickedKot = await page.evaluate(() => {
     // Find the KOT button. Be careful about finding the exact button.
     const kot = [...document.querySelectorAll('button')].find(b => b.innerText && b.innerText.includes('KOT'));
     if (kot) { kot.click(); return true; }
     return false;
  });
  console.log('Clicked KOT:', clickedKot);
  await page.waitForTimeout(2000);
  console.log('Test completed.');
  await browser.close();
})();
