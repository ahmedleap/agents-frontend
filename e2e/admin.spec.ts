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
  for (const width of [1280, 1024, 390]) {
    test(`every table's View buttons fit on a ${width}px-wide screen`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.route('**/api/v1/admin/clients', route => route.fulfill({ json: [
        { clientId: '3f2b9c1e-5a7d-4e8f-9b0c-1d2e3f4a5b6c', firstName: 'Alexandria', lastName: 'Montgomery-Whitfield', email: 'alexandria.montgomery@example.com', riskTolerance: 'AGGRESSIVE', portfolioSizeRange: 'BETWEEN_100K_200K', portfolioValue: 153261.4, createdAt: '2026-10-01T00:00:00Z' }
      ] }));
      await page.route('**/api/v1/admin/accounts', route => route.fulfill({ json: [
        { accountId: '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f', name: 'Retirement savings account', clientId: '3f2b9c1e-5a7d-4e8f-9b0c-1d2e3f4a5b6c', clientName: 'Alexandria Montgomery-Whitfield', cashBalance: 1250000, status: 'SUSPENDED', openDate: '2026-10-01' }
      ] }));
      await page.route('**/api/v1/admin/orders', route => route.fulfill({ json: [
        { orderId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', accountId: '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f', clientId: '3f2b9c1e-5a7d-4e8f-9b0c-1d2e3f4a5b6c', clientName: 'Alexandria Montgomery-Whitfield', ticker: 'GOOGL', instrumentName: 'Alphabet Inc. Class A', side: 'SELL', quantity: 12500, limitPrice: 1234.56, filledPrice: 1234.5, status: 'CANCELLED', cancellationReason: 'Client request', createdAt: '2026-10-27T12:28:23Z' }
      ] }));
      await loginAsAdmin(page);

      const tabs = page.getByRole('navigation', { name: 'Admin views' });
      for (const tab of ['Clients', 'Accounts', 'Orders']) {
        await tabs.getByRole('button', { name: tab }).click();
        const view = page.locator('table tbody').getByRole('button', { name: 'View' });
        await expect(view).toBeInViewport({ ratio: 1 });
      }

      // Order IDs aren't shown in the orders table
      await expect(page.locator('thead th', { hasText: /^Order$/ })).toHaveCount(0);
      await expect(page.locator('table')).not.toContainText('9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d');
    });
  }
});
