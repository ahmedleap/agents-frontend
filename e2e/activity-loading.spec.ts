import { expect, test } from '@playwright/test';

const clientId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const firstAccountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondAccountId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(clientId => {
    const user = { clientId, email: 'client@example.com', role: 'CLIENT' };
    const claims = { sub: clientId, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + 900 };
    const accessToken = `${btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${btoa(JSON.stringify(claims))}.test-signature`;
    sessionStorage.setItem('stash-auth-session', JSON.stringify({ user, accessToken, refreshToken: 'test-refresh-token' }));
  }, clientId);

  await page.route('**/dashboard?**', route => route.fulfill({ status: 404, body: 'Not found' }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let body: unknown = [];
    if (url.pathname === `/api/portfolio/v1/${clientId}`) {
      body = { accounts: [
        { accountId: firstAccountId, accountName: 'First account', totalPortfolioValue: 1000 },
        { accountId: secondAccountId, accountName: 'Second account', totalPortfolioValue: 2500 }
      ] };
    } else if (url.pathname.endsWith('/summary')) {
      body = { availableBalance: 1250, cashBalance: 1250 };
    } else if (url.pathname.endsWith('/transactions')) {
      body = [{ transactionId: 'cash-1', type: 'DEPOSIT', amount: 1250, createdAt: '2026-10-20T12:00:00Z' }];
    } else if (url.pathname === '/api/v1/orders') {
      body = [{ orderId: 'order-1', ticker: 'AAPL', submittedAt: '2026-10-20T12:00:00Z',
        orderType: 'BUY', quantity: 3, status: 'FILLED', filledPrice: 200 }];
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
});

test('transactions load the URL account and balance when dashboard is unavailable', async ({ page }) => {
  const request = page.waitForRequest(request => request.url().includes(`/accounts/${secondAccountId}/transactions`));
  await page.goto(`/transactions/${secondAccountId}`);
  await request;
  await expect(page.getByRole('combobox', { name: 'Select account transactions' })).toHaveValue(secondAccountId);
  await expect(page.locator('.balance-card strong')).toHaveText('$1,250.00');
  await expect(page.getByRole('row').filter({ hasText: 'DEPOSIT' })).toContainText('$1,250.00');

  const switchedRequest = page.waitForRequest(request => request.url().includes(`/accounts/${firstAccountId}/transactions`));
  await page.getByRole('combobox', { name: 'Select account transactions' }).selectOption(firstAccountId);
  await switchedRequest;
  await expect(page).toHaveURL(new RegExp(`/transactions/${firstAccountId}$`));
});

test('history loads the URL account with no dashboard dependency, including reload', async ({ page }) => {
  const request = page.waitForRequest(request => request.url().includes(`/v1/orders?accountId=${secondAccountId}`));
  await page.goto(`/history/${secondAccountId}`);
  await request;
  await expect(page.getByRole('combobox', { name: 'Select account history' })).toHaveValue(secondAccountId);
  await expect(page.getByRole('row').filter({ hasText: 'AAPL' })).toContainText('FILLED');
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: 'AAPL' })).toBeVisible();
});

test('an unavailable account list does not suppress activity requests for the URL account', async ({ page }) => {
  await page.route(`**/api/portfolio/v1/${clientId}`, route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto(`/history/${secondAccountId}`);
  await expect(page.getByRole('alert')).toContainText('Account names could not be loaded');
  await expect(page.getByRole('row').filter({ hasText: 'AAPL' })).toBeVisible();
});