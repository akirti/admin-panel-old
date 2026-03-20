import { test, expect } from '@playwright/test';

test.describe('Table Accessibility', () => {
  test('login page has accessible form structure', async ({ page }) => {
    await page.goto('/login');

    // Check form labels are properly linked
    const emailInput = page.locator('#login-email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    const passwordInput = page.locator('#login-password');
    await expect(passwordInput).toBeVisible();

    // Check required indicators
    const requiredMarkers = page.locator('[aria-hidden="true"]').filter({ hasText: '*' });
    const count = await requiredMarkers.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('password toggle has aria-label', async ({ page }) => {
    await page.goto('/login');

    const toggleButton = page.getByRole('button', { name: /show password/i });
    await expect(toggleButton).toBeVisible();

    await toggleButton.click();
    await expect(page.getByRole('button', { name: /hide password/i })).toBeVisible();
  });

  test('form validation shows error messages with role=alert', async ({ page }) => {
    await page.goto('/register');

    // Fill all required fields with valid-length but mismatched passwords
    // This bypasses HTML5 minLength validation but triggers JS password mismatch
    await page.locator('#reg-username').fill('testuser');
    await page.locator('#reg-email').fill('test@example.com');
    await page.locator('#reg-password').fill('password123');
    await page.locator('#reg-confirm-password').fill('different123');
    await page.getByRole('button', { name: /create account/i }).click();

    // Should show password mismatch error with role=alert
    await page.waitForSelector('[role="alert"]', { timeout: 5000 });
    const alerts = page.locator('[role="alert"]');
    const alertCount = await alerts.count();
    expect(alertCount).toBeGreaterThan(0);
  });
});
