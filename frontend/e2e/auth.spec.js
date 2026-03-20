import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form with proper labels', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should require email and password fields', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /sign in/i });
    await submitButton.click();
    // HTML5 validation should prevent submission
    const emailInput = page.locator('#login-email');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.locator('#login-password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = page.getByRole('button', { name: /show password/i });
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.locator('#login-email').fill('invalid@test.com');
    await page.locator('#login-password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error toast or remain on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should navigate to register page', async ({ page }) => {
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test('should navigate to forgot password', async ({ page }) => {
    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('should have keyboard navigable form', async ({ page }) => {
    await page.locator('#login-email').focus();
    await page.keyboard.press('Tab');
    // Focus should move to password field
    const passwordInput = page.locator('#login-password');
    await expect(passwordInput).toBeFocused();
  });
});
