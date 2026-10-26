import { Page } from '@playwright/test';
import { test, expect } from './helpers';

const ADMIN_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

async function loginAsAdmin(page: Page) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub: ADMIN_ID, email: 'admin@example.com', role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 900 })}.test-signature`;
  await page.route('**/api/v1/auth/admin/login', route => route.fulfill({
    json: { accessToken, refreshToken: 'r', expiresIn: 900, user: { clientId: ADMIN_ID, email: 'admin@example.com', role: 'ADMIN' } }
  }));
  await page.goto('/login');
  await page.getByLabel('Admin / Analyst').check();
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel(/^Password/).fill('Secret123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe('Admin console', () => {
  test('the Clients, Accounts and Orders tables are paginated', async ({ page }) => {
    // 40 clients (Client 01..40) and 20 accounts
    const pad = (n: number) => String(n).padStart(2, '0');
    const clients = Array.from({ length: 40 }, (_, i) => ({
      clientId: `c${pad(i + 1)}`, firstName: 'Client', lastName: pad(i + 1), email: `client${pad(i + 1)}@example.com`,
      riskTolerance: 'MODERATE', portfolioSizeRange: 'UNDER_50K', createdAt: '2026-10-01T00:00:00Z'
    }));
    const accounts = Array.from({ length: 20 }, (_, i) => ({
      accountId: `a${pad(i + 1)}`, name: `Account ${pad(i + 1)}`, clientId: 'c01', clientName: 'Client 01',
      cashBalance: 1000, status: 'ACTIVE', openDate: '2026-10-01'
    }));
    await page.route('**/api/v1/admin/clients', route => route.fulfill({ json: clients }));
    await page.route('**/api/v1/admin/accounts', route => route.fulfill({ json: accounts }));
    await page.route('**/api/v1/admin/orders', route => route.fulfill({ json: [] }));
    await loginAsAdmin(page);

    const rows = page.locator('table tbody tr');
    const pager = page.getByRole('navigation', { name: 'Clients pages' });
    await expect(rows).toHaveCount(15);
    await expect(pager).toContainText('Showing 1–15 of 40');

    await pager.getByRole('button', { name: 'Page 3' }).click();
    await expect(rows).toHaveCount(10);
    await expect(pager).toContainText('Showing 31–40 of 40');

    // Searching starts again on page 1; a single page has no pager
    await page.getByRole('searchbox', { name: /Search clients/ }).fill('client0');
    await expect(rows).toHaveCount(9);
    await expect(pager).toHaveCount(0);
    await page.getByRole('searchbox', { name: /Search clients/ }).fill('');
    await expect(pager.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');

    // Other tabs have their own pages, starting on page 1
    await pager.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('navigation', { name: 'Admin views' }).getByRole('button', { name: 'Accounts' }).click();
    const accountPager = page.getByRole('navigation', { name: 'Accounts pages' });
    await expect(rows).toHaveCount(15);
    await expect(accountPager).toContainText('Showing 1–15 of 20');
    await accountPager.getByRole('button', { name: 'Next page' }).click();
    await expect(rows).toHaveCount(5);
  });

  test('shows each client portfolio value from the backend', async ({ page }) => {
    await page.route('**/api/v1/admin/clients', route => route.fulfill({ json: [
      { clientId: 'c1', firstName: 'Ava', lastName: 'Nguyen', email: 'ava@example.com', portfolioValue: 53261.4 },
      { clientId: 'c2', firstName: 'Ben', lastName: 'Patel', email: 'ben@example.com', portfolioValue: 0 }
    ] }));
    await page.route('**/api/v1/admin/accounts', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/admin/orders', route => route.fulfill({ json: [] }));
    await loginAsAdmin(page);

    // Portfolio value is the 6th column
    await expect(page.getByRole('row', { name: /Ava Nguyen/ }).locator('td').nth(5)).toHaveText('$53,261');
    await expect(page.getByRole('row', { name: /Ben Patel/ }).locator('td').nth(5)).toHaveText('$0');
  });
});
