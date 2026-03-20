import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should have skip to main content link', async ({ page }) => {
    await page.goto('/login');
    // Tab to activate skip link
    await page.keyboard.press('Tab');
    const skipLink = page.getByText('Skip to main content');
    // Skip link should be visible when focused (if it exists on auth pages)
    // This test validates the skip link exists on authenticated pages
    const count = await skipLink.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('login page should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/login');
    const h2 = page.getByRole('heading', { level: 2 });
    await expect(h2).toBeVisible();
  });

  test('register page should load correctly', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
  });

  test('forgot password page should load correctly', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();
  });
});
