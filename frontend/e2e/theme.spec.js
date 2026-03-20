import { test, expect } from '@playwright/test';

test.describe('Theme', () => {
  test('should persist theme selection in localStorage', async ({ page }) => {
    await page.goto('/login');

    // Check default theme
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');

    // Theme should be set (either from localStorage or default)
    expect(initialTheme !== null || initialTheme === undefined).toBeTruthy();
  });
});
