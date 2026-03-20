import { test, expect } from '@playwright/test';

test.describe('Chart Components', () => {
  test('dashboard redirects unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin dashboard redirects unauthenticated users', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('all management pages redirect when not authenticated', async ({ page }) => {
    const pages = [
      '/admin/users',
      '/admin/roles',
      '/admin/groups',
      '/admin/permissions',
      '/admin/customers',
      '/admin/domains',
      '/admin/scenarios',
    ];

    for (const path of pages) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
