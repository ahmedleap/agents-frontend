import { Page } from '@playwright/test';
import { test, expect, loginAsClient } from './helpers';

const account = { accountId: '11111111-1111-4111-8111-111111111111', name: 'Brokerage' };

/** YYYY-MM-DD for `daysAgo` days before today, in the browser's (and test machine's) time zone */
function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-CA');
}

/** Replaces the dashboard response's value history (accounts are worth $100 in total today) */
async function fakeHistory(page: Page, history: { date: string; totalValue: number }[]) {
  await page.route(url => url.pathname === '/api/dashboard' && url.searchParams.has('clientId'), route => route.fulfill({
    json: {
      accounts: [{ ...account, status: 'ACTIVE', cashBalance: 100, availableBalance: 100, totalValue: 100 }],
      marketMovers: [], watchlist: [], recentTrades: [],
      portfolioHistory: history, todayProfitLoss: 0, todayProfitLossPercent: 0
    }
  }));
}

test.describe('Dashboard value chart', () => {
  test('shows the 30-day change from the daily history, ending at today\'s live total', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeHistory(page, [
      { date: isoDaysAgo(20), totalValue: 80 },
      { date: isoDaysAgo(10), totalValue: 90 }
    ]);
    await page.goto('/home');

    const card = page.locator('.chart-card');
    await expect(card).toContainText('Last 30 days');
    // $80 twenty days ago -> $100 today
    await expect(card.locator('.card-head strong')).toHaveText('+$20.00 (+25.00%)');
    await expect(card.locator('.chart-empty')).toHaveCount(0);
  });

  test('says there is no history yet instead of "Last 0 days" and a $0 change', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeHistory(page, []);
    await page.goto('/home');

    const card = page.locator('.chart-card');
    await expect(card).toContainText('Last 30 days');
    await expect(card).not.toContainText('Last 0 days');
    await expect(card.locator('.card-head strong')).toHaveCount(0);
    await expect(card.locator('.chart-empty')).toContainText('No value history yet');
  });
});

test.describe('Dashboard after switching clients', () => {
  test('shows only the signed-in client\'s trades, without a reload', async ({ page }) => {
    // Two clients log in one after the other in the same tab
    const clients = {
      'old@example.com': { clientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', accountName: 'Old brokerage', ticker: 'TSLA' },
      'new@example.com': { clientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', accountName: 'New brokerage', ticker: null }
    };
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    await page.route('**/api/v1/auth/login', route => {
      const email = route.request().postDataJSON().email as keyof typeof clients;
      const { clientId } = clients[email];
      const accessToken = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub: clientId, email, role: 'CLIENT', exp: Math.floor(Date.now() / 1000) + 900 })}.test-signature`;
      return route.fulfill({ json: { accessToken, refreshToken: 'r', expiresIn: 900, user: { clientId, email, firstName: 'Test', lastName: 'Client', role: 'CLIENT' } } });
    });
    await page.route('**/api/v1/auth/logout', route => route.fulfill({ json: {} }));
    await page.route(url => url.pathname === '/api/dashboard' && url.searchParams.has('clientId'), route => {
      const client = Object.values(clients).find(c => c.clientId === new URL(route.request().url()).searchParams.get('clientId'))!;
      return route.fulfill({ json: {
        accounts: [{ accountId: `${client.clientId.slice(0, 8)}-acct`, name: client.accountName, status: 'ACTIVE', cashBalance: 100, availableBalance: 100, totalValue: 100 }],
        watchlist: [], portfolioHistory: [], todayProfitLoss: 0, todayProfitLossPercent: 0,
        recentTrades: client.ticker ? [{ orderId: 'o1', createdAt: '2026-10-27T12:28:23Z', orderType: 'BUY', ticker: client.ticker, quantity: 5, filledPrice: 250, accountName: client.accountName }] : []
      } });
    });
    await page.route('**/api/v1/instruments/market-movers', route => route.fulfill({ json: {
      marketMovers: [{ ticker: 'AAPL', price: 200, changePercent: 1.5 }], asOf: '', refreshedAt: '', isStale: false
    } }));

    const logIn = async (email: string) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel(/^Password/).fill('Secret123!');
      await page.getByRole('button', { name: 'Log in' }).click();
      await expect(page).toHaveURL(/\/home$/);
    };
    const recentTrades = page.locator('.recent-trades');

    await logIn('old@example.com');
    await expect(recentTrades).toContainText('TSLA');

    // Log out and straight back in as someone else (page.goto('/login') would reload, so use the app's own button)
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email').fill('new@example.com');
    await page.getByLabel(/^Password/).fill('Secret123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/home$/);

    await expect(recentTrades).toContainText('No trades yet.');
    await expect(recentTrades).not.toContainText('TSLA');
    await expect(page.getByText('Old brokerage')).toHaveCount(0);

    // Market movers have no Volume column
    await expect(page.locator('.movers thead th')).toHaveText(['Stock', 'Price', 'Change']);
  });
});

test.describe('Dashboard greeting', () => {
  for (const [hour, part] of [[9, 'morning'], [14, 'afternoon'], [20, 'evening']] as const) {
    test(`says good ${part} with the client's first name at ${hour}:00`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(2026, 9, 28, hour, 0));
      await loginAsClient(page, [account]);
      await fakeHistory(page, []);
      await page.goto('/home');

      await expect(page.locator('.toolbar .greeting-text')).toHaveText(`Good ${part}, Jane!`);
    });
  }
});
