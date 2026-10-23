// test/expect from helpers.ts block any middleware/backend call a test hasn't faked
import { expect, test } from './helpers';

const CLIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function tokenFor(role: 'CLIENT' | 'ADMIN' | 'ANALYST', sub: string, email: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub, email, role, exp: Math.floor(Date.now() / 1000) + 900 })}.test-signature`;
}

async function stubLogin(page: import('@playwright/test').Page, role: 'CLIENT' | 'ADMIN' | 'ANALYST', endpoint: 'login' | 'admin/login', sub = CLIENT_ID) {
  const email = 'jane@example.com';
  if (role === 'CLIENT') {
    // Loaded after a client logs in (GET /dashboard?clientId=...&period=30D)
    await page.route(url => url.pathname === '/dashboard' && url.searchParams.has('clientId'), route => route.fulfill({
      json: { accounts: [], marketMovers: [], watchlist: [], recentTrades: [], portfolioHistory: [], todayProfitLoss: 0, todayProfitLossPercent: 0 }
    }));
  }
  await page.route(`**/api/v1/auth/${endpoint}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      accessToken: tokenFor(role, sub, email),
      refreshToken: 'test-refresh-token',
      expiresIn: 900,
      user: { clientId: sub, email, firstName: 'Jane', lastName: 'Trader', role }
    })
  }));
}

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // The app opens on the login page
    await expect(page).toHaveURL(/\/login$/);
  });

  test('routes clients to their own account view after login', async ({ page }) => {
    await stubLogin(page, 'CLIENT', 'login');
    await page.route(`**/api/portfolio/v1/${CLIENT_ID}`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        clientId: CLIENT_ID,
        accounts: [{ accountId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', accountName: 'Primary', totalPortfolioValue: 1200, totalCostBasis: 1000, totalGainLossDollars: 200, totalGainLossPercent: 20 }],
        totalPortfolioValue: 1200,
        totalCostBasis: 1000,
        totalGainLossDollars: 200,
        totalGainLossPercent: 20
      })
    }));
    await page.getByLabel('Email').fill('jane@example.com');
    // The label also wraps the Show/Hide button, so its name starts with "Password" but isn't exactly that
    await page.getByLabel(/^Password/).fill('Secret123!');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/home$/);
    // /home is the client's dashboard
    await expect(page.getByRole('heading', { level: 2, name: 'Dashboard', exact: true })).toBeVisible();
    // The sidebar is back once the user is past the login page, listing the client's own accounts
    const sidebar = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole('button', { name: 'Account' }).click();
    await expect(sidebar.getByRole('link', { name: /Primary/ })).toBeVisible();
  });

  test('routes staff logins by the role returned by the issuer', async ({ page }) => {
    await stubLogin(page, 'ANALYST', 'admin/login', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    await page.route('**/api/v1/analytics/platform/metrics', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ totalClients: 100, activeClientsLast30Days: 75, totalAccounts: 120, activeAccountsLast30Days: 90, totalAssetsUnderManagement: 1_000_000, averagePortfolioSize: 10_000, totalOrders: 80, totalFilledOrders: 65, orderFulfillmentRate: 81.25, totalValueTraded: 250_000 })
    }));
    await page.route('**/api/v1/analytics/dashboard/total-volume', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ totalQuantityTraded: 400, totalValueTraded: 60_000, totalOrdersExecuted: 65, percentChangeYTD: 2.5 })
    }));
    await page.route('**/api/v1/analytics/dashboard/total-trades', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ totalTrades: 80, filledTrades: 65, cancelledTrades: 5, pendingTrades: 10, fulfillmentRate: 81.25, cancellationRate: 6.25, buyOrderCount: 44, sellOrderCount: 36 })
    }));
    await page.getByLabel('Admin / Analyst').check();
    await page.getByLabel('Email').fill('analyst@example.com');
    await page.getByLabel(/^Password/).fill('Secret123!');
    await page.getByRole('button', { name: 'Log in' }).click();

    // Analysts land on the analytics page, and it's the only page in their sidebar
    await expect(page).toHaveURL(/\/analytics$/);
    await expect(page.getByRole('heading', { name: 'Analytics Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link')).toHaveText(['Analysis']);
  });

  test('routes admins to the admin-only overview', async ({ page }) => {
    await stubLogin(page, 'ADMIN', 'admin/login', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    await page.route('**/api/v1/admin/clients', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/v1/admin/accounts', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/v1/admin/insights', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ clientCount: 0, accountCount: 0, orderCount: 0, filledOrderCount: 0, tradedValue: 0 })
    }));
    await page.getByLabel('Admin / Analyst').check();
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel(/^Password/).fill('Secret123!');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
  });

  test('stays on the login page when the form is empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    await expect(page.getByText('Enter your password')).toBeVisible();
  });
});

test.describe('Login password eye', () => {
  test('the eye shows the password and closes, then hides it again; hovering says Show or Hide', async ({ page }) => {
    await page.goto('/login');
    const password = page.getByLabel(/^Password/);
    await password.fill('Secret123!');
    await expect(password).toHaveAttribute('type', 'password');

    const show = page.getByRole('button', { name: 'Show password' });
    await expect(show.locator('svg.open')).toBeVisible();
    // Hovering says what a click will do
    await show.hover();
    await expect(show.locator('.tip')).toHaveText('Show');
    await expect(show.locator('.tip')).toHaveCSS('opacity', '1');
    await show.click();
    await expect(password).toHaveAttribute('type', 'text');
    const hide = page.getByRole('button', { name: 'Hide password' });
    await expect(hide).toHaveAttribute('aria-pressed', 'true');
    await expect(hide.locator('svg.closed')).toBeVisible();
    await expect(hide.locator('.tip')).toHaveText('Hide');

    await hide.click();
    await expect(password).toHaveAttribute('type', 'password');
  });
});
