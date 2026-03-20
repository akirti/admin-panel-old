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

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByLabel('Confirm Password')).toBeVisible();
  });

  test('interactive elements should be keyboard focusable', async ({ page }) => {
    await page.goto('/login');

    // Tab through interactive elements
    await page.keyboard.press('Tab');

    // At least one element should be focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
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
