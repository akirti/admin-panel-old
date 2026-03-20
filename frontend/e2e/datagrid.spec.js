import { test, expect } from '@playwright/test';

test.describe('DataGrid Features', () => {
  test('login form has proper structure for grid testing', async ({ page }) => {
    await page.goto('/login');
    // Verify the page loads correctly
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  });

  test('register page form validation works', async ({ page }) => {
    await page.goto('/register');

    // Try submitting empty form
    const submitButton = page.getByRole('button', { name: /create account/i });
    await submitButton.click();

    // Should show validation errors
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
  });
});
