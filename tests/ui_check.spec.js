const { test, expect } = require('@playwright/test');

test('UI check screenshot', async ({ page }) => {
  await page.goto('file://' + __dirname + '/../index.html');
  await page.waitForSelector('.shelf-slot:not(.empty)');
  await page.screenshot({ path: 'verification/verification.png', fullPage: true });
});
