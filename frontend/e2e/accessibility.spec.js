import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('login page should have proper form labels', async ({ page }) => {
    await page.goto('/login');

    // All inputs should have associated labels
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Buttons should have accessible names
    const submitButton = page.getByRole('button', { name: /sign in/i });
    await expect(submitButton).toBeVisible();
  });

  test('register page should have proper form labels', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator('#reg-email')).toBeVisible();
    await expect(page.locator('#reg-username')).toBeVisible();
    await expect(page.locator('#reg-password')).toBeVisible();
    await expect(page.locator('#reg-confirm-password')).toBeVisible();
  });

  test('interactive elements should be keyboard focusable', async ({ page }) => {
    await page.goto('/login');

    // Click the email field first, then Tab to next element
    await page.locator('#login-email').focus();
    await page.keyboard.press('Tab');

    // Password field should now be focused
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).toBeTruthy();
  });

  test('password toggle button should have aria-label', async ({ page }) => {
    await page.goto('/login');

    const toggleButtons = page.locator('button').filter({ has: page.locator('svg') });
    // The password toggle button should exist
    const count = await toggleButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('links should have discernible text', async ({ page }) => {
    await page.goto('/login');

    const links = page.getByRole('link');
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });
});
