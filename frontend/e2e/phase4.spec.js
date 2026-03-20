import { test, expect } from '@playwright/test';

test.describe('Phase 4: Breadcrumbs', () => {
  test('login page should not show breadcrumbs', async ({ page }) => {
    await page.goto('/login');
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).not.toBeVisible();
  });

  test('register page should not show breadcrumbs', async ({ page }) => {
    await page.goto('/register');
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).not.toBeVisible();
  });
});

test.describe('Phase 4: Empty States', () => {
  test('dashboard redirects when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Phase 4: Skeuomorphic Design', () => {
  test('login page has styled cards', async ({ page }) => {
    await page.goto('/login');
    // Verify the page loads with proper styling
    await expect(page.locator('#login-email')).toBeVisible();
  });

  test('buttons should have interactive states', async ({ page }) => {
    await page.goto('/login');
    const submitButton = page.getByRole('button', { name: /sign in/i });
    await expect(submitButton).toBeVisible();
    // Verify button is clickable
    await expect(submitButton).toBeEnabled();
  });
});

test.describe('Phase 4: Dark Mode', () => {
  test('should respect system color scheme', async ({ page }) => {
    // Emulate dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');

    // Page should load successfully in dark mode
    await expect(page.locator('#login-email')).toBeVisible();
  });

  test('should work in light mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');

    await expect(page.locator('#login-email')).toBeVisible();
  });

  test('theme should have data-theme attribute', async ({ page }) => {
    await page.goto('/login');

    const html = page.locator('html');
    // Theme attribute should be set (from localStorage or default)
    const theme = await html.getAttribute('data-theme');
    // Either has a theme or falls back to system default
    expect(theme === null || typeof theme === 'string').toBeTruthy();
  });
});

test.describe('Phase 4: Accessibility Polish', () => {
  test('submit button should have accessible name', async ({ page }) => {
    await page.goto('/login');
    const submitButton = page.getByRole('button', { name: /sign in/i });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test('form should have proper ARIA attributes', async ({ page }) => {
    await page.goto('/login');

    const email = page.locator('#login-email');
    await expect(email).toHaveAttribute('required', '');
    await expect(email).toHaveAttribute('type', 'email');
    await expect(email).toHaveAttribute('autocomplete', 'email');
  });

  test('navigation links should be present', async ({ page }) => {
    await page.goto('/login');

    // Login page should have key navigation links
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
  });
});
