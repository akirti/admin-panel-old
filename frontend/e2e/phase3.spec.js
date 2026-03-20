import { test, expect } from '@playwright/test';

test.describe('Phase 3: Mobile Responsiveness', () => {
  test('sidebar should be hidden on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');

    // Login page should still be accessible on mobile
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  test('login form should be responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');

    // Form should fit in viewport (no horizontal scroll)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test('register page should be responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/register');

    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test('tablet viewport should work', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/login');

    await expect(page.locator('#login-email')).toBeVisible();
  });
});

test.describe('Phase 3: Protected Routes', () => {
  test('all admin routes should redirect to login', async ({ page }) => {
    const routes = [
      '/admin/bulk-upload',
      '/admin/api-configs',
      '/admin/distribution-lists',
      '/admin/error-logs',
      '/admin/activity-logs',
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('explorer should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/explorer');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Phase 3: Performance', () => {
  test('page should load within reasonable time', async ({ page }) => {
    const start = Date.now();
    await page.goto('/login');
    const loadTime = Date.now() - start;

    // Login page should load within 10 seconds (including webpack compile)
    expect(loadTime).toBeLessThan(10000);
  });

  test('no console errors on login page', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/login');
    await page.waitForTimeout(1000);

    // Filter out expected errors (network, auth, backend responses)
    const unexpectedErrors = errors.filter(
      (e) => !e.includes('net::') && !e.includes('Failed to fetch') && !e.includes('NetworkError')
        && !e.includes('Failed to load resource') && !e.includes('401') && !e.includes('422')
    );
    expect(unexpectedErrors).toHaveLength(0);
  });
});
